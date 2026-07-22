import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REQUEST_DOCUMENT_SIZE_BYTES,
  assertSameRequestOnResubmission,
  compareRequestChanges,
  createResubmissionWorkflowEvent,
  ensureStudentCanModifyStatus,
  ensureStudentOwnsRequest,
  isRequestInSupervisorReviewFilter,
  normalizeCorrectionPayload,
  notifySupervisorOfResubmission,
  shouldDisplayResubmittedBadge,
  validateUploadedStageRequestDocument
} from "../services/stageRequestCorrectionService.js";

test("demande marquee comme incomplete", () => {
  const correction = normalizeCorrectionPayload({
    status: "A_REVISER",
    reason: "Champ obligatoire incomplet",
    correctionItems: "Adresse de l'entreprise",
    studentComment:
      "Merci de corriger l'adresse avant resoumission.",
    missingDocuments: []
  });

  assert.equal(correction.status, "A_REVISER");
});

test("commentaire obligatoire", () => {
  assert.throws(
    () =>
      normalizeCorrectionPayload({
        status: "A_REVISER",
        reason: "Champ obligatoire incomplet",
        correctionItems: "Adresse",
        studentComment: ""
      }),
    /commentaire/
  );
});

test("etudiant autorise a rouvrir sa propre demande", () => {
  assert.doesNotThrow(() =>
    ensureStudentCanModifyStatus("A_REVISER")
  );
  assert.doesNotThrow(() =>
    ensureStudentCanModifyStatus("DOCUMENTS_MANQUANTS")
  );
});

test("autre etudiant interdit d'acces", () => {
  assert.throws(
    () => ensureStudentOwnsRequest(null),
    /introuvable/
  );
});

test("ajout d'un document manquant", () => {
  const document = validateUploadedStageRequestDocument({
    documentType: "CAQ",
    originalName: "caq.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-test")
  });

  assert.equal(document.documentType, "CAQ");
});

test("remplacement d'un document", () => {
  const changes = compareRequestChanges(
    { companyName: "Ancienne entreprise" },
    { companyName: "Nouvelle entreprise" }
  );

  assert.equal(changes[0].field, "companyName");
});

test("resoumission de la meme demande", () => {
  assert.equal(
    assertSameRequestOnResubmission(12, "12"),
    true
  );
});

test("absence de creation d'une deuxieme demande", () => {
  assert.throws(
    () => assertSameRequestOnResubmission(12, 13),
    /meme identifiant/
  );
});

test("notification creee pour l'enseignant", async () => {
  const executed = [];
  const fakeConnection = {
    async execute(sql, params) {
      executed.push({ sql, params });

      if (sql.includes("INSERT INTO notifications")) {
        return [{ insertId: 55 }];
      }

      return [{}];
    }
  };

  await notifySupervisorOfResubmission(
    fakeConnection,
    {
      supervisorId: 9,
      studentFullName: "Marie Tremblay",
      requestId: 12,
      changedFields: [
        { label: "adresse entreprise" }
      ],
      uploadedDocuments: ["CAQ"]
    }
  );

  assert.equal(
    executed.some((query) =>
      query.params?.includes(
        "DEMANDE_STAGE_RESOUMISE"
      )
    ),
    true
  );
});

test("badge Resoumise visible", () => {
  assert.equal(
    shouldDisplayResubmittedBadge({
      status: "SOUMISE",
      resubmittedAt: "2026-07-22T10:00:00Z"
    }),
    true
  );
});

test("demande replacee dans A traiter", () => {
  assert.equal(
    isRequestInSupervisorReviewFilter({
      status: "SOUMISE"
    }),
    true
  );
});

test("historique des modifications", async () => {
  const executed = [];
  const fakeConnection = {
    async execute(sql, params) {
      executed.push({ sql, params });
      return [{}];
    }
  };

  await createResubmissionWorkflowEvent(
    fakeConnection,
    {
      folderId: 4,
      actorId: 7,
      oldStatus: "DOCUMENTS_MANQUANTS",
      changedFields: [
        { label: "telephone entreprise" }
      ],
      uploadedDocuments: ["ASSURANCE"]
    }
  );

  assert.equal(
    executed[0].params.includes("DEMANDE_RESOUMISE"),
    true
  );
});

test("refus definitif empeche la modification", () => {
  assert.throws(
    () => ensureStudentCanModifyStatus("REFUSEE"),
    /refusee definitivement/
  );
});

test("validation de type et taille des documents", () => {
  assert.throws(
    () =>
      validateUploadedStageRequestDocument({
        documentType: "CAQ",
        originalName: "script.exe",
        mimeType: "application/x-msdownload",
        buffer: Buffer.from("bad")
      }),
    /Type de fichier/
  );

  assert.throws(
    () =>
      validateUploadedStageRequestDocument({
        documentType: "CAQ",
        originalName: "caq.pdf",
        mimeType: "application/pdf",
        size: MAX_REQUEST_DOCUMENT_SIZE_BYTES + 1,
        buffer: Buffer.alloc(1)
      }),
    /taille maximale/
  );
});
