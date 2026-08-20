import assert from "node:assert/strict";
import test from "node:test";

import mysql from "mysql2/promise";

const originalCreatePool = mysql.createPool;
const fakeDb = createFakeDb();

let createPoolCallCount = 0;
mysql.createPool = () => {
  createPoolCallCount += 1;
  return fakeDb.pool;
};

let contractService;
try {
  contractService = await import(
    `../services/contractService.js?demoSigning=${Date.now()}`
  );
} finally {
  mysql.createPool = originalCreatePool;
}

test.after(() => {
  mysql.createPool = originalCreatePool;
});

test.beforeEach(() => {
  fakeDb.reset();
});

test("mode demonstration actif retourne les signataires du contrat", async () => {
  const result = await callDemoSigningLinks({
    user: supervisorUser(),
    contractId: 1001
  });

  assert.equal(result.testMode, true);
  assert.equal(result.contractId, 1001);
  assert.equal(result.signers.length, 5);
  assert.deepEqual(
    result.signers.map((signer) => signer.role),
    [
      "ETUDIANT",
      "ENTREPRISE",
      "SUPERVISEUR",
      "CONSEILLERE",
      "DIRECTION"
    ]
  );
  assert.deepEqual(
    result.signers.map((signer) => signer.signingUrl),
    [
      "https://documenso.test/sign/student-1001",
      "https://documenso.test/sign/company-1001",
      "https://documenso.test/sign/supervisor-1001",
      "",
      "https://documenso.test/sign/direction-1001"
    ]
  );
  assert.equal(
    result.signers.some((signer) =>
      signer.signingUrl.includes("other-contract")
    ),
    false
  );
  assertNoExternalEffects();
});

test("mode demonstration absent refuse sans lire la base", async () => {
  await assert.rejects(
    () =>
      callDemoSigningLinks({
        env: { NODE_ENV: "test" },
        user: supervisorUser(),
        contractId: 1001
      }),
    hasStatus(403)
  );

  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("mode demonstration false refuse sans lire la base", async () => {
  await assert.rejects(
    () =>
      callDemoSigningLinks({
        env: {
          STAGETEC_TEST_MODE: "false",
          NODE_ENV: "test"
        },
        user: supervisorUser(),
        contractId: 1001
      }),
    hasStatus(403)
  );

  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("mode demonstration refuse en production", async () => {
  await assert.rejects(
    () =>
      callDemoSigningLinks({
        env: {
          STAGETEC_TEST_MODE: "true",
          NODE_ENV: "production"
        },
        user: supervisorUser(),
        contractId: 1001
      }),
    hasStatus(403)
  );

  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("role non autorise refuse sans lire la base", async () => {
  await assert.rejects(
    () =>
      callDemoSigningLinks({
        user: {
          id: 3001,
          role: "ETUDIANT"
        },
        contractId: 1001
      }),
    hasStatus(404)
  );

  assert.equal(fakeDb.calls.length, 0);
  assertNoExternalEffects();
});

test("superviseur non assigne au contrat refuse", async () => {
  await assert.rejects(
    () =>
      callDemoSigningLinks({
        user: {
          id: 2999,
          role: "SUPERVISEUR"
        },
        contractId: 1001
      }),
    hasStatus(404)
  );

  assert.equal(fakeDb.contractSelectCount(), 1);
  assert.equal(fakeDb.signerSelectCount(), 0);
  assertNoExternalEffects();
});

test("contrat inexistant refuse", async () => {
  await assert.rejects(
    () =>
      callDemoSigningLinks({
        user: supervisorUser(),
        contractId: 9999
      }),
    hasStatus(404)
  );

  assert.equal(fakeDb.contractSelectCount(), 1);
  assert.equal(fakeDb.signerSelectCount(), 0);
  assertNoExternalEffects();
});

test("les signing URLs viennent uniquement de signatures_contrat", async () => {
  const result = await callDemoSigningLinks({
    user: {
      id: 7001,
      role: "CONSEILLERE"
    },
    contractId: 1001
  });

  const urls = result.signers.map((signer) => signer.signingUrl);
  assert.deepEqual(urls, [
    "https://documenso.test/sign/student-1001",
    "https://documenso.test/sign/company-1001",
    "https://documenso.test/sign/supervisor-1001",
    "",
    "https://documenso.test/sign/direction-1001"
  ]);
  assert.equal(urls.includes("https://documenso.test/sign/intrus"), false);
  assert.equal(urls.includes("https://documenso.test/sign/other-contract"), false);
  assertNoExternalEffects();
});

test("signing URL absente retourne une valeur vide", async () => {
  const result = await callDemoSigningLinks({
    user: supervisorUser(),
    contractId: 1001
  });

  const counsellor = result.signers.find(
    (signer) => signer.role === "CONSEILLERE"
  );

  assert.equal(counsellor.signingUrl, "");
  assertNoExternalEffects();
});

test("la lecture des liens ne modifie aucun statut", async () => {
  await callDemoSigningLinks({
    user: supervisorUser(),
    contractId: 1001
  });

  assert.equal(fakeDb.writeCalls.length, 0);
  assert.equal(fakeDb.hasSqlWriteMatching(/statut\s*=\s*'SIGNE'/i), false);
  assert.equal(
    fakeDb.signersByContract.get(1001).find(
      (signer) => signer.role === "ETUDIANT"
    ).status,
    "ENVOYE"
  );
  assertNoExternalEffects();
});

test("aucune connexion Aiven reelle n'est utilisee", async () => {
  await callDemoSigningLinks({
    user: supervisorUser(),
    contractId: 1001
  });

  assert.ok(createPoolCallCount > 0);
  assert.equal(fakeDb.realConnectionAttempted, false);
  assertNoExternalEffects();
});

async function callDemoSigningLinks({
  env = {
    STAGETEC_TEST_MODE: "true",
    NODE_ENV: "test"
  },
  user,
  contractId
}) {
  return withEnv(env, () =>
    withNoNetworkCalls(() =>
      contractService.getContractDemoSigningLinksForUser(
        user,
        contractId
      )
    )
  );
}

async function withEnv(values, action) {
  const keys = [
    "STAGETEC_TEST_MODE",
    "NODE_ENV"
  ];
  const previous = new Map(
    keys.map((key) => [key, process.env[key]])
  );

  for (const key of keys) {
    if (Object.hasOwn(values, key)) {
      process.env[key] = values[key];
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

function supervisorUser() {
  return {
    id: 2001,
    role: "SUPERVISEUR"
  };
}

function hasStatus(status) {
  return (error) => {
    assert.equal(error.status, status);
    return true;
  };
}

function assertNoExternalEffects() {
  assert.equal(fakeDb.writeCalls.length, 0);
  assert.equal(fakeDb.realConnectionAttempted, false);
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
        const contractId = Number(params[0]);
        const contract = state.contractsById.get(contractId);
        return [[contract ? { ...contract } : undefined].filter(Boolean)];
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
    contractsById: state.contractsById,
    signersByContract: state.signersByContract,
    get realConnectionAttempted() {
      return state.realConnectionAttempted;
    },
    reset() {
      state.calls.length = 0;
      state.writeCalls.length = 0;
      state.realConnectionAttempted = false;
      state.contractsById.clear();
      state.signersByContract.clear();
      state.contractsById.set(1001, {
        id: 1001,
        studentId: 3001,
        teacherId: 2001
      });
      state.contractsById.set(1002, {
        id: 1002,
        studentId: 3002,
        teacherId: 2002
      });
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
        }),
        demoSigner({
          id: 6,
          role: "INTRUS",
          signingOrder: 6,
          userId: null,
          name: "Intrus",
          email: "intrus@example.test",
          signingUrl: "https://documenso.test/sign/intrus"
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
