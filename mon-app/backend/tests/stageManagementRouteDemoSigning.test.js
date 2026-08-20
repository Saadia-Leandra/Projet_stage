import assert from "node:assert/strict";
import {
  createServer,
  request as createHttpRequest
} from "node:http";
import test from "node:test";

import express from "express";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";

import { createToken } from "../services/jwt.js";

const originalCreatePool = mysql.createPool;
const originalCreateTransport = nodemailer.createTransport;
const fakeDb = createFakeDb();
let createPoolCallCount = 0;
let emailSendAttemptCount = 0;

mysql.createPool = () => {
  createPoolCallCount += 1;
  return fakeDb.pool;
};
nodemailer.createTransport = () => {
  emailSendAttemptCount += 1;
  throw new Error("Envoi email interdit dans ce test.");
};

let stageManagementRoutes;
try {
  stageManagementRoutes = (
    await import(
      `../routes/stageManagementRoute.js?routeDemo=${Date.now()}`
    )
  ).default;
} finally {
  mysql.createPool = originalCreatePool;
}

let server;
let port;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/stage-management", stageManagementRoutes);
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      error: error.message || "Erreur serveur."
    });
  });

  server = createServer(app);
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  port = server.address().port;
});

test.after(async () => {
  mysql.createPool = originalCreatePool;
  nodemailer.createTransport = originalCreateTransport;

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test.beforeEach(() => {
  fakeDb.reset();
  emailSendAttemptCount = 0;
});

test("GET /contracts expose le mode demonstration hors production", async () => {
  const response = await requestJson({
    path: "/contracts",
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.testMode, {
    demoSigning: true
  });
  assert.equal(response.body.contracts.length, 1);
  assertNoExternalEffects();
});

test("GET /contracts sans variable de test n'expose pas testMode", async () => {
  const response = await requestJson({
    path: "/contracts",
    env: { NODE_ENV: "test" },
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.body, "testMode"), false);
  assertNoExternalEffects();
});

test("GET /contracts avec STAGETEC_TEST_MODE=false n'expose pas testMode", async () => {
  const response = await requestJson({
    path: "/contracts",
    env: {
      STAGETEC_TEST_MODE: "false",
      NODE_ENV: "test"
    },
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.body, "testMode"), false);
  assertNoExternalEffects();
});

test("GET /contracts n'expose pas testMode en production", async () => {
  const response = await requestJson({
    path: "/contracts",
    env: {
      STAGETEC_TEST_MODE: "true",
      NODE_ENV: "production"
    },
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assert.equal(Object.hasOwn(response.body, "testMode"), false);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links refuse sans authentification", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links"
  });

  assert.equal(response.status, 401);
  assert.match(response.body.error, /Authentification requise/);
  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links refuse le role etudiant", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor({
      id: 3001,
      role: "ETUDIANT"
    })
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /Acces refuse/);
  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links accepte un superviseur assigne", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor(supervisorUser())
  });

  assertDemoSigningResponse(response, 1001);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links accepte une conseillere", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor({
      id: 7001,
      role: "CONSEILLERE"
    })
  });

  assertDemoSigningResponse(response, 1001);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links accepte la direction", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor({
      id: 8001,
      role: "DIRECTION"
    })
  });

  assertDemoSigningResponse(response, 1001);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links refuse un superviseur non assigne", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor({
      id: 2999,
      role: "SUPERVISEUR"
    })
  });

  assert.equal(response.status, 404);
  assert.match(response.body.error, /acces refuse/i);
  assert.equal(fakeDb.contractSelectCount(), 1);
  assert.equal(fakeDb.signerSelectCount(), 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links refuse quand le mode est absent", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    env: { NODE_ENV: "test" },
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /Mode demonstration desactive/);
  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links refuse quand le mode vaut false", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    env: {
      STAGETEC_TEST_MODE: "false",
      NODE_ENV: "test"
    },
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /Mode demonstration desactive/);
  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links refuse en production", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    env: {
      STAGETEC_TEST_MODE: "true",
      NODE_ENV: "production"
    },
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 403);
  assert.match(response.body.error, /Mode demonstration desactive/);
  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links valide l'identifiant", async () => {
  const response = await requestJson({
    path: "/contracts/abc/demo-signing-links",
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 400);
  assert.match(response.body.error, /Identifiant de contrat invalide/);
  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links retourne seulement les champs attendus", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor(supervisorUser())
  });
  const signerKeys = [
    "email",
    "id",
    "label",
    "name",
    "role",
    "signatureProvider",
    "signedAt",
    "signingOrder",
    "signingUrl",
    "status"
  ];

  assertDemoSigningResponse(response, 1001);
  assert.deepEqual(
    Object.keys(response.body).sort(),
    ["contractId", "signers", "testMode"]
  );
  response.body.signers.forEach((signer) => {
    assert.deepEqual(Object.keys(signer).sort(), signerKeys);
  });
  assert.deepEqual(
    response.body.signers.map((signer) => signer.signingUrl),
    [
      "https://documenso.test/sign/student-1001",
      "https://documenso.test/sign/company-1001",
      "https://documenso.test/sign/supervisor-1001",
      "",
      "https://documenso.test/sign/direction-1001"
    ]
  );
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links n'expose aucun secret serveur", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assertNoSecrets(response.body);
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links envoie Cache-Control no-store", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assertNoExternalEffects();
});

test("GET /contracts/:id/demo-signing-links reste sans effet de bord", async () => {
  const response = await requestJson({
    path: "/contracts/1001/demo-signing-links",
    token: tokenFor(supervisorUser())
  });

  assert.equal(response.status, 200);
  assert.equal(fakeDb.writeCalls.length, 0);
  assert.equal(fakeDb.hasSqlWriteMatching(/\bstatut\s*=\s*'SIGNE'/i), false);
  assert.equal(fakeDb.realConnectionAttempted, false);
  assert.equal(emailSendAttemptCount, 0);
  assert.ok(createPoolCallCount > 0);
  assertNoExternalEffects();
});

async function requestJson({
  path,
  token = "",
  env = {
    STAGETEC_TEST_MODE: "true",
    NODE_ENV: "test"
  }
}) {
  return withRouteEnv(env, () =>
    withNoNetworkCalls(() =>
      sendRequest({
        path,
        token
      })
    )
  );
}

function sendRequest({ path, token }) {
  return new Promise((resolve, reject) => {
    const headers = {};

    if (token) {
      headers.authorization = `Bearer ${token}`;
    }

    const request = createHttpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: `/api/stage-management${path}`,
        method: "GET",
        headers
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body = {};

          try {
            body = text ? JSON.parse(text) : {};
          } catch (error) {
            reject(error);
            return;
          }

          resolve({
            status: response.statusCode,
            headers: response.headers,
            body
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

async function withRouteEnv(values, action) {
  const keys = [
    "STAGETEC_TEST_MODE",
    "NODE_ENV",
    "DOCUMENSO_API_KEY",
    "DOCUMENSO_WEBHOOK_SECRET",
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD"
  ];
  const previous = new Map(
    keys.map((key) => [key, process.env[key]])
  );

  for (const key of keys) {
    if (Object.hasOwn(values, key)) {
      process.env[key] = values[key];
    } else if (
      key === "DOCUMENSO_API_KEY" ||
      key.startsWith("SMTP_")
    ) {
      process.env[key] = "";
    } else if (key === "DOCUMENSO_WEBHOOK_SECRET") {
      process.env[key] = "forbidden-webhook-secret";
    } else if (key.startsWith("DB_")) {
      process.env[key] = `forbidden-${key.toLowerCase()}`;
    } else {
      delete process.env[key];
    }
  }

  try {
    return await action();
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withNoNetworkCalls(action) {
  const previousFetch = globalThis.fetch;
  const fetchCalls = [];

  globalThis.fetch = (...args) => {
    fetchCalls.push(args);
    throw new Error("Appel reseau interdit dans ce test.");
  };

  try {
    const result = await action();
    assert.equal(fetchCalls.length, 0);
    return result;
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function tokenFor(user) {
  return createToken({
    ...user,
    email: user.email || `${user.role.toLowerCase()}@teccart.ca`
  });
}

function supervisorUser() {
  return {
    id: 2001,
    role: "SUPERVISEUR"
  };
}

function assertDemoSigningResponse(response, contractId) {
  assert.equal(response.status, 200);
  assert.equal(response.body.testMode, true);
  assert.equal(response.body.contractId, contractId);
  assert.equal(response.body.signers.length, 5);
  assert.deepEqual(
    response.body.signers.map((signer) => signer.role),
    [
      "ETUDIANT",
      "ENTREPRISE",
      "SUPERVISEUR",
      "CONSEILLERE",
      "DIRECTION"
    ]
  );
  assert.equal(
    response.body.signers.some((signer) =>
      signer.signingUrl.includes("other-contract")
    ),
    false
  );
}

function assertNoSecrets(body) {
  const text = JSON.stringify(body);

  [
    "DOCUMENSO_API_KEY",
    "DOCUMENSO_WEBHOOK_SECRET",
    "DB_PASSWORD",
    "DB_HOST",
    "DB_USER",
    "forbidden-webhook-secret",
    "forbidden-db_password",
    "forbidden-db_host",
    "forbidden-db_user",
    "forbidden-smtp_password",
    "apiKey",
    "webhookSecret",
    "password",
    "secret"
  ].forEach((secret) => {
    assert.equal(
      text.includes(secret),
      false,
      `La reponse expose ${secret}.`
    );
  });
}

function assertNoExternalEffects() {
  assert.equal(fakeDb.writeCalls.length, 0);
  assert.equal(fakeDb.realConnectionAttempted, false);
  assert.equal(emailSendAttemptCount, 0);
}

function createFakeDb() {
  const allowedRoles = new Set([
    "ETUDIANT",
    "ENTREPRISE",
    "SUPERVISEUR",
    "CONSEILLERE",
    "DIRECTION"
  ]);
  const state = {
    calls: [],
    writeCalls: [],
    realConnectionAttempted: false,
    contractsById: new Map(),
    signersByContract: new Map()
  };

  const pool = {
    async execute(sql, params = []) {
      const query = String(sql);
      state.calls.push({ sql: query, params });

      if (isWriteQuery(query)) {
        state.writeCalls.push({ sql: query, params });
        throw new Error(`Requete d'ecriture interdite: ${query}`);
      }

      if (query.includes("FROM contrats c")) {
        if (query.includes("WHERE c.id = ?")) {
          const contract = state.contractsById.get(Number(params[0]));
          return [[contract ? { ...contract } : undefined].filter(Boolean)];
        }

        return [contractsVisibleInList(query, params, state)];
      }

      if (query.includes("FROM signatures_contrat")) {
        const contractId = Number(params[0]);
        const signers = state.signersByContract.get(contractId) || [];
        return [
          signers
            .filter((signer) => allowedRoles.has(signer.role))
            .map((signer) => ({ ...signer }))
        ];
      }

      throw new Error(`Requete inattendue dans le test: ${query}`);
    },
    async getConnection() {
      state.realConnectionAttempted = true;
      throw new Error("Connexion DB interdite dans ce test.");
    }
  };

  return {
    pool,
    calls: state.calls,
    writeCalls: state.writeCalls,
    get realConnectionAttempted() {
      return state.realConnectionAttempted;
    },
    reset() {
      state.calls.length = 0;
      state.writeCalls.length = 0;
      state.realConnectionAttempted = false;
      state.contractsById.clear();
      state.signersByContract.clear();
      state.contractsById.set(1001, contractRow({
        id: 1001,
        teacherId: 2001,
        studentId: 3001
      }));
      state.contractsById.set(1002, contractRow({
        id: 1002,
        teacherId: 2002,
        studentId: 3002
      }));
      state.signersByContract.set(1001, [
        demoSigner({
          id: 1,
          role: "ETUDIANT",
          signingOrder: 1,
          userId: 3001,
          name: "Etudiant Demo",
          email: "etudiant.demo@teccart.ca",
          signingUrl: "https://documenso.test/sign/student-1001"
        }),
        demoSigner({
          id: 2,
          role: "ENTREPRISE",
          signingOrder: 2,
          userId: null,
          name: "Entreprise Demo",
          email: "signature@entreprise.test",
          signingUrl: "https://documenso.test/sign/company-1001"
        }),
        demoSigner({
          id: 3,
          role: "SUPERVISEUR",
          signingOrder: 3,
          userId: 2001,
          name: "Superviseur Demo",
          email: "superviseur.demo@teccart.ca",
          signingUrl: "https://documenso.test/sign/supervisor-1001"
        }),
        demoSigner({
          id: 4,
          role: "CONSEILLERE",
          signingOrder: 4,
          userId: 7001,
          name: "Conseillere Demo",
          email: "conseillere.demo@teccart.ca",
          signingUrl: null
        }),
        demoSigner({
          id: 5,
          role: "DIRECTION",
          signingOrder: 5,
          userId: 8001,
          name: "Direction Demo",
          email: "direction.demo@teccart.ca",
          signingUrl: "https://documenso.test/sign/direction-1001"
        })
      ]);
      state.signersByContract.set(1002, [
        demoSigner({
          id: 20,
          role: "ETUDIANT",
          signingOrder: 1,
          userId: 3002,
          name: "Autre Etudiant",
          email: "autre.etudiant@teccart.ca",
          signingUrl: "https://documenso.test/sign/other-contract"
        })
      ]);
    },
    contractSelectCount() {
      return state.calls.filter((call) =>
        call.sql.includes("FROM contrats c")
      ).length;
    },
    signerSelectCount() {
      return state.calls.filter((call) =>
        call.sql.includes("FROM signatures_contrat")
      ).length;
    },
    hasSqlWriteMatching(pattern) {
      return state.writeCalls.some((call) =>
        pattern.test(call.sql)
      );
    }
  };
}

function contractsVisibleInList(query, params, state) {
  const contracts = [...state.contractsById.values()];

  if (query.includes("WHERE ds.superviseur_id = ?")) {
    const teacherId = Number(params[0]);
    return contracts
      .filter((contract) => Number(contract.teacherId) === teacherId)
      .map((contract) => ({ ...contract }));
  }

  return contracts.map((contract) => ({ ...contract }));
}

function contractRow({ id, teacherId, studentId }) {
  return {
    id,
    folderId: id + 100,
    requestId: id + 200,
    status: "SIGNATURE_SUPERVISEUR",
    documensoDocumentId: `documenso-${id}`,
    documensoStatus: "SENT",
    submittedAt: "2026-07-21T12:00:00.000Z",
    completedAt: null,
    rejectedAt: null,
    createdAt: "2026-07-20T12:00:00.000Z",
    requestStatus: "APPROUVEE",
    startDate: "2026-07-10",
    endDate: "2026-08-20",
    folderStatus: "ATTENTE_SIGNATURE",
    studentId,
    studentName: `Etudiant ${id}`,
    studentEmail: `etudiant${id}@teccart.ca`,
    studentCode: `26${id}`,
    program: "Developpement web",
    companyName: `Entreprise ${id}`,
    companyCity: "Montreal",
    teacherId,
    teacherName: `Superviseur ${teacherId}`,
    signedCount: 1,
    signerCount: 5,
    nextSigningOrder: 3
  };
}

function demoSigner({
  id,
  role,
  signingOrder,
  userId,
  name,
  email,
  signingUrl
}) {
  return {
    id,
    signingOrder,
    role,
    userId,
    name,
    email,
    accountEmail: email,
    accountStatus: "ACTIF",
    status: "ENVOYE",
    signatureProvider: "DOCUMENSO",
    documensoRecipientId: `recipient-${id}`,
    signingUrl,
    signedAt: null
  };
}

function isWriteQuery(sql) {
  return /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/i.test(sql);
}
