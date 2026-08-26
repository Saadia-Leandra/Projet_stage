import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import {
  assertValidPdf,
  generateContractPdf,
  generateInternshipRequestPdf,
  getOfficialSignatureDateStampPlan,
  resolveContractStoragePath,
  saveSignedContractPdf,
  stampContractSignaturesOnPdf
} from "../services/contractPdfService.js";

test("genere un PDF de contrat valide", async () => {
  const contract = {
    id: 123,
    externalId: "stagetec-test-123",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    studentCode: "2600001",
    codeProgram: "420",
    program: "Developpement web",
    schoolYear: "2026",
    session: "ETE",
    companyName: "ACME",
    companyAddress: "100 rue Exemple",
    companyCity: "Montreal",
    companyPostalCode: "H1H 1H1",
    companySupervisorName: "Julie Martin",
    companySupervisorEmail: "julie@example.com",
    teacherFirstName: "Tom",
    teacherLastName: "Prof",
    startDate: "2026-07-10",
    endDate: "2026-08-20",
    workSchedule: "Lundi au vendredi",
    scheduleType: "TEMPS_PLEIN",
    hoursPerWeek: 35,
    numberOfWeeks: 6,
    totalHours: 210,
    functionStage: "Stagiaire developpeur",
    descriptionStage: "Developpement de modules internes.",
    isPaid: true,
    hourlySalary: 20
  };

  const signers = [
    {
      signingOrder: 1,
      role: "ENTREPRISE",
      name: "Julie Martin",
      email: "julie@example.com"
    },
    {
      signingOrder: 2,
      role: "SUPERVISEUR",
      name: "Tom Prof",
      email: "tom@example.com"
    }
  ];

  const file = await generateContractPdf(
    contract,
    signers
  );

  const header = await fs.readFile(file.absolutePath, {
    encoding: "ascii"
  });
  const pdfDoc = await PDFDocument.load(
    await fs.readFile(file.absolutePath)
  );

  assert.equal(header.slice(0, 5), "%PDF-");
  assert.equal(pdfDoc.getPageCount(), 7);
  assert.match(file.fileName, /-contrat-\d{14}-[0-9a-f]{8}\.pdf$/);
  assert.doesNotMatch(file.fileName, /contrat-original|signed/);
  assert.equal(
    resolveContractStoragePath(file.relativePath),
    file.absolutePath
  );

  await fs.rm(file.absolutePath, { force: true });
});

test("nomme le PDF signe en francais", async () => {
  const contract = {
    id: 321,
    externalId: "stagetec-test-321",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    companyName: "ACME"
  };
  const originalFile = await generateContractPdf(contract);
  const signedFile = await saveSignedContractPdf(
    contract,
    await fs.readFile(originalFile.absolutePath)
  );

  assert.match(
    signedFile.fileName,
    /-contrat-signe-\d{14}-[0-9a-f]{8}\.pdf$/
  );
  assert.doesNotMatch(signedFile.fileName, /signed/);

  await fs.rm(originalFile.absolutePath, { force: true });
  await fs.rm(signedFile.absolutePath, { force: true });
});

test("genere une demande de stage PDF valide", async () => {
  const request = {
    id: 456,
    taskSummary:
      "Developpement et validation de modules internes.",
    startDate: "2026-07-10",
    endDate: "2026-08-20",
    companyName: "ACME",
    companyAddress: "100 rue Exemple",
    companyCity: "Montreal",
    companyPostalCode: "H1H 1H1",
    companyPhone: "514-555-0100",
    companyPhoneExtension: "123",
    hrName: "Sophie RH",
    hrEmail: "rh@example.com",
    hrPhone: "514-555-0101",
    hrExtension: "456",
    workSchedule: "Lundi au vendredi",
    hoursPerWeek: 35,
    workLanguage: "Francais",
    companyWebsite: "https://example.com",
    supervisorName: "Julie Martin",
    supervisorTitle: "Directrice TI",
    supervisorEmail: "julie@example.com",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    studentGroup: "420-A",
    studentEmail: "marie@example.com",
    studentPhone: "514-555-0123"
  };

  const file = await generateInternshipRequestPdf(
    request
  );

  const header = await fs.readFile(file.absolutePath, {
    encoding: "ascii"
  });
  const pdfDoc = await PDFDocument.load(
    await fs.readFile(file.absolutePath)
  );

  assert.equal(header.slice(0, 5), "%PDF-");
  assert.equal(pdfDoc.getPageCount(), 2);

  await fs.rm(file.absolutePath, { force: true });
});

test("ajoute l'attestation des signatures au PDF final", async () => {
  const contract = {
    id: 789,
    externalId: "stagetec-test-789",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    companyName: "ACME",
    completedAt: "2026-07-31T14:30:00.000Z",
    confirmationCode: "STG-2026-ABC123"
  };
  const file = await generateContractPdf(contract);
  const sourceBuffer = await fs.readFile(
    file.absolutePath
  );

  const stampedBuffer =
    await stampContractSignaturesOnPdf(
      sourceBuffer,
      {
        contract,
        includeAttestation: true,
        signers: [
          {
            role: "ETUDIANT",
            name: "Marie Tremblay",
            email: "marie@example.com",
            status: "SIGNE",
            signedAt:
              "2026-07-31T14:00:00.000Z",
            signatureProvider: "DOCUMENSO"
          },
          {
            role: "ENTREPRISE",
            name: "Julie Martin",
            email: "julie@example.com",
            status: "SIGNE",
            signedAt:
              "2026-07-31T14:10:00.000Z",
            signatureProvider: "AUTRE"
          },
          {
            role: "SUPERVISEUR",
            name: "Tom Prof",
            email: "tom@example.com",
            status: "SIGNE",
            signedAt:
              "2026-07-31T14:20:00.000Z",
            signatureProvider: "DOCUMENSO"
          }
        ]
      }
    );
  const pdfDoc = await PDFDocument.load(stampedBuffer);

  assert.equal(pdfDoc.getPageCount(), 8);

  await fs.rm(file.absolutePath, { force: true });
});

test("conserve le PDF Documenso signe sans tampons StageTec par defaut", async () => {
  const contract = {
    id: 790,
    externalId: "stagetec-test-790",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    companyName: "ACME"
  };
  const file = await generateContractPdf(contract);
  const sourceBuffer = await fs.readFile(
    file.absolutePath
  );

  const savedFile = await saveSignedContractPdf(
    contract,
    sourceBuffer,
    {
      signers: [
        {
          role: "ETUDIANT",
          name: "Marie Tremblay",
          status: "SIGNE",
          signedAt: "2026-07-31T14:00:00.000Z",
          signatureProvider: "DOCUMENSO"
        }
      ]
    }
  );
  const pdfDoc = await PDFDocument.load(
    await fs.readFile(savedFile.absolutePath)
  );

  assert.equal(pdfDoc.getPageCount(), 7);

  await fs.rm(file.absolutePath, { force: true });
  await fs.rm(savedFile.absolutePath, { force: true });
});

test("prepare les dates officielles de signature par role", () => {
  const plan = getOfficialSignatureDateStampPlan(
    [
      {
        role: "ETUDIANT",
        status: "SIGNE",
        signedAt: "2026-01-10T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      },
      {
        role: "ENTREPRISE",
        status: "SIGNE",
        signedAt: "2026-01-12T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      },
      {
        role: "SUPERVISEUR",
        status: "SIGNE",
        signedAt: "2026-01-15T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      },
      {
        role: "CONSEILLERE",
        status: "SIGNE",
        signedAt: "2026-01-17T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      },
      {
        role: "DIRECTION",
        status: "SIGNE",
        signedAt: "2026-01-19T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      }
    ]
  );

  assert.deepEqual(
    plan.map(({ role, zone, text, pageIndex, boxX, boxY }) => ({
      role,
      zone,
      text,
      pageIndex,
      boxX,
      boxY
    })),
    [
      {
        role: "ETUDIANT",
        zone: "SIGNATURE_ETUDIANT",
        text: "10/01/2026",
        pageIndex: 2,
        boxX: 210,
        boxY: 764
      },
      {
        role: "ENTREPRISE",
        zone: "SIGNATURE_MILIEU_STAGE",
        text: "12/01/2026",
        pageIndex: 2,
        boxX: 210,
        boxY: 716
      },
      {
        role: "SUPERVISEUR",
        zone: "APPROBATION_PEDAGOGIQUE",
        text: "15/01/2026",
        pageIndex: 2,
        boxX: 504,
        boxY: 764
      },
      {
        role: "CONSEILLERE",
        zone: "APPROBATION_ADMINISTRATION",
        text: "17/01/2026",
        pageIndex: 1,
        boxX: 512,
        boxY: 690
      },
      {
        role: "DIRECTION",
        zone: "DIRECTION_PROGRAMME",
        text: "19/01/2026",
        pageIndex: 2,
        boxX: 504,
        boxY: 716
      }
    ]
  );
});

test("ignore les dates non signees, absentes ou non Documenso", () => {
  const plan = getOfficialSignatureDateStampPlan(
    [
      {
        role: "ETUDIANT",
        status: "EN_ATTENTE",
        signedAt: "2026-01-10T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      },
      {
        role: "ENTREPRISE",
        status: "SIGNE",
        signedAt: "2026-01-12T15:00:00.000Z",
        signatureProvider: "AUTRE"
      },
      {
        role: "SUPERVISEUR",
        status: "SIGNE",
        signatureProvider: "DOCUMENSO"
      },
      {
        role: "CONSEILLERE",
        status: "SIGNE",
        signedAt: "2026-01-17T15:00:00.000Z",
        signatureProvider: "DOCUMENSO"
      }
    ]
  );

  assert.deepEqual(
    plan.map(({ role, text }) => ({ role, text })),
    [
      {
        role: "CONSEILLERE",
        text: "17/01/2026"
      }
    ]
  );
});

test("estampille seulement les dates de la phase courante", async () => {
  const contract = {
    id: 791,
    externalId: "stagetec-test-791",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    companyName: "ACME",
    completedAt: "2026-01-20T15:00:00.000Z",
    confirmationCode: "STG-2026-DATES"
  };
  const originalFile = await generateContractPdf(contract);
  const sourceBuffer = await fs.readFile(
    originalFile.absolutePath
  );
  const signers = [
    {
      role: "ETUDIANT",
      status: "SIGNE",
      signedAt: "2026-01-10T15:00:00.000Z",
      signatureProvider: "DOCUMENSO"
    },
    {
      role: "ENTREPRISE",
      status: "SIGNE",
      signedAt: "2026-01-12T15:00:00.000Z",
      signatureProvider: "DOCUMENSO"
    },
    {
      role: "SUPERVISEUR",
      status: "SIGNE",
      signedAt: "2026-01-15T15:00:00.000Z",
      signatureProvider: "DOCUMENSO"
    },
    {
      role: "CONSEILLERE",
      status: "SIGNE",
      signedAt: "2026-01-17T15:00:00.000Z",
      signatureProvider: "DOCUMENSO"
    },
    {
      role: "DIRECTION",
      status: "SIGNE",
      signedAt: "2026-01-19T15:00:00.000Z",
      signatureProvider: "DOCUMENSO"
    }
  ];

  const studentFile = await saveSignedContractPdf(
    contract,
    sourceBuffer,
    {
      signers,
      includeOfficialDates: true,
      officialDateRoles: ["ETUDIANT"]
    }
  );
  const milieuFile = await saveSignedContractPdf(
    contract,
    await fs.readFile(studentFile.absolutePath),
    {
      signers,
      includeOfficialDates: true,
      officialDateRoles: ["ENTREPRISE"]
    }
  );
  const finalFile = await saveSignedContractPdf(
    contract,
    await fs.readFile(milieuFile.absolutePath),
    {
      signers,
      includeOfficialDates: true,
      officialDateRoles: [
        "SUPERVISEUR",
        "CONSEILLERE",
        "DIRECTION"
      ],
      includeAttestation: true
    }
  );
  const pdfDoc = await PDFDocument.load(
    await fs.readFile(finalFile.absolutePath)
  );

  assert.equal(pdfDoc.getPageCount(), 8);
  assert.deepEqual(
    getOfficialSignatureDateStampPlan(signers, [
      "ETUDIANT"
    ]).map(({ role }) => role),
    ["ETUDIANT"]
  );
  assert.deepEqual(
    getOfficialSignatureDateStampPlan(signers, [
      "ENTREPRISE"
    ]).map(({ role }) => role),
    ["ENTREPRISE"]
  );
  assert.deepEqual(
    getOfficialSignatureDateStampPlan(signers, [
      "SUPERVISEUR",
      "CONSEILLERE",
      "DIRECTION"
    ]).map(({ role }) => role),
    ["SUPERVISEUR", "CONSEILLERE", "DIRECTION"]
  );

  await fs.rm(originalFile.absolutePath, { force: true });
  await fs.rm(studentFile.absolutePath, { force: true });
  await fs.rm(milieuFile.absolutePath, { force: true });
  await fs.rm(finalFile.absolutePath, { force: true });
});

test("rejette les chemins de stockage relatifs dangereux", () => {
  assert.throws(
    () => resolveContractStoragePath("../secret.pdf"),
    /Chemin de fichier invalide/
  );
});

test("retourne une erreur 404 explicite lorsqu'un PDF stocke est absent", async () => {
  const missingPath = resolveContractStoragePath(
    `original/pdf-absent-${Date.now()}.pdf`
  );

  await assert.rejects(
    assertValidPdf(missingPath),
    (error) => {
      assert.equal(error.status, 404);
      assert.match(error.message, /introuvable/);
      return true;
    }
  );
});
