import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { createDbPool } from "../config/db.js";
import {
  generateContractPdf,
  resolveContractStoragePath,
  saveSignedContractPdf,
  assertValidPdf
} from "./contractPdfService.js";
import {
  createAndSendDocument,
  downloadSignedPdf,
  getDocumensoConfigMessage,
  isDocumensoConfigured
} from "./documensoService.js";
import { createNotificationForUsers } from "./notificationService.js";

const db = createDbPool();

const contractStatusBySignerRole = {
  ETUDIANT: "SIGNATURE_ETUDIANT",
  SUPERVISEUR: "SIGNATURE_SUPERVISEUR",
  CONSEILLERE: "SIGNATURE_CONSEILLERE",
  DIRECTION: "SIGNATURE_DIRECTION"
};

const administrativeSignerRoles = [
  "SUPERVISEUR",
  "CONSEILLERE",
  "DIRECTION"
];

export const MAX_MILIEU_SIGNED_PDF_SIZE_BYTES =
  15 * 1024 * 1024;

const documensoEventStatuses = {
  DOCUMENT_CREATED: "CREATED",
  DOCUMENT_SENT: "SENT",
  DOCUMENT_OPENED: "OPENED",
  DOCUMENT_SIGNED: "SIGNED",
  DOCUMENT_RECIPIENT_COMPLETED: "RECIPIENT_COMPLETED",
  DOCUMENT_COMPLETED: "COMPLETED",
  DOCUMENT_REJECTED: "REJECTED",
  DOCUMENT_CANCELLED: "CANCELLED"
};

export async function getStudentContracts(studentId) {
  const contracts = await findContractsForStudent(
    db,
    studentId
  );

  return Promise.all(
    contracts.map(async (contract) => ({
      ...formatContract(contract),
      signers: await getContractSigners(db, contract.id)
    }))
  );
}

export async function getStudentContractById(
  studentId,
  contractId
) {
  const contract = await findStudentContractById(
    db,
    studentId,
    contractId
  );

  return {
    ...formatContract(contract),
    signers: await getContractSigners(db, contract.id)
  };
}

export async function updateStudentContract(
  studentId,
  contractId,
  data
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const contract = await findStudentContractById(
      connection,
      studentId,
      contractId,
      true
    );

    ensureContractCanBeEdited(contract);

    const cleanedData = validateContractData(
      data,
      contract
    );

    await connection.execute(
      `
        UPDATE contrats
        SET
          annee_scolaire = ?,
          session = ?,
          code_programme = ?,
          fonction_stage = ?,
          description_stage = ?,
          est_remunere = ?,
          salaire_horaire = ?,
          compensation_monetaire = ?,
          autre_compensation = ?,
          heures_semaine = ?,
          nombre_semaines = ?,
          total_heures = ?,
          type_horaire = ?
        WHERE id = ?
      `,
      [
        cleanedData.schoolYear,
        cleanedData.session,
        cleanedData.codeProgram,
        cleanedData.functionStage,
        cleanedData.descriptionStage,
        cleanedData.isPaid,
        cleanedData.hourlySalary,
        cleanedData.monetaryCompensation,
        cleanedData.otherCompensation,
        cleanedData.hoursPerWeek,
        cleanedData.numberOfWeeks,
        cleanedData.totalHours,
        cleanedData.scheduleType,
        contract.id
      ]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getStudentContractById(studentId, contractId);
}

export async function generateStudentContractPdf(
  studentId,
  contractId
) {
  const contract = await findStudentContractById(
    db,
    studentId,
    contractId
  );

  ensureContractCanBeEdited(contract);
  validateContractReadyForSubmission(contract);

  const signers = await getContractSigners(
    db,
    contract.id
  );

  const pdf = await generateContractPdf(
    contract,
    signers
  );

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE contrats
        SET
          chemin_fichier_genere = ?,
          pdf_original_path = ?,
          genere_le = NOW()
        WHERE id = ?
      `,
      [pdf.relativePath, pdf.relativePath, contract.id]
    );

    await saveDocumentRecord(connection, {
      folderId: contract.folderId,
      contractId: contract.id,
      userId: studentId,
      type: "CONTRAT_GENERE",
      fileName: pdf.fileName,
      filePath: pdf.relativePath,
      status: "DEPOSE"
    });

    await createWorkflowEvent(connection, {
      folderId: contract.folderId,
      actorId: studentId,
      eventType: "CONTRAT_PDF_GENERE",
      oldStatus: contract.status,
      newStatus: contract.status,
      comment:
        "Le contrat officiel a ete genere en PDF."
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getStudentContractById(studentId, contractId);
}

export async function generateContractPdfForContract(
  connection,
  contractId,
  actorId
) {
  const contract = await findContractById(
    connection,
    contractId
  );
  const signers = await getContractSigners(
    connection,
    contract.id
  );
  const pdf = await generateContractPdf(
    contract,
    signers
  );

  await connection.execute(
    `
      UPDATE contrats
      SET
        chemin_fichier_genere = ?,
        pdf_original_path = ?,
        genere_le = NOW()
      WHERE id = ?
    `,
    [pdf.relativePath, pdf.relativePath, contract.id]
  );

  await saveDocumentRecord(connection, {
    folderId: contract.folderId,
    contractId: contract.id,
    userId: actorId,
    type: "CONTRAT_GENERE",
    fileName: pdf.fileName,
    filePath: pdf.relativePath,
    mimeType: "application/pdf",
    status: "DEPOSE"
  });

  await createWorkflowEvent(connection, {
    folderId: contract.folderId,
    actorId,
    eventType: "CONTRAT_PDF_GENERE",
    oldStatus: contract.status,
    newStatus: contract.status,
    comment:
      "Le contrat officiel a ete genere automatiquement apres l'approbation de la demande."
  });

  return pdf;
}

export async function submitStudentContract(
  studentId,
  contractId
) {
  let contract;
  let signers;
  let externalId;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    contract = await findStudentContractById(
      connection,
      studentId,
      contractId,
      true
    );

    ensureContractCanBeEdited(contract);
    validateContractReadyForSubmission(contract);

    externalId =
      contract.externalId ||
      makeContractExternalId(contract);

    signers = await syncContractSignersForContract(
      connection,
      contract.id,
      { resetStatus: true }
    );

    validateSigners(
      signers.filter(
        (signer) => signer.role === "ETUDIANT"
      )
    );

    await connection.execute(
      `
        UPDATE contrats
        SET external_id = ?
        WHERE id = ?
      `,
      [externalId, contract.id]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (!isDocumensoConfigured()) {
    throw createError(
      getDocumensoConfigMessage(),
      503
    );
  }

  const pdf = await generateContractPdf(
    { ...contract, externalId },
    signers
  );
  const studentSigner = signers.find(
    (signer) => signer.role === "ETUDIANT"
  );

  const documensoDocument =
    await createAndSendDocument({
      pdfPath: pdf.absolutePath,
      title: `Contrat de stage - ${
        contract.companyName || contract.id
      }`,
      externalId,
      recipients: [
        {
          signingOrder: 1,
          role: studentSigner.role,
          name: studentSigner.name,
          email: studentSigner.email
        }
      ]
    });

  await saveDocumensoPhaseSubmission({
    actorId: studentId,
    contract,
    signers: [studentSigner],
    pdf,
    documensoDocument,
    externalId,
    newStatus: "SIGNATURE_ETUDIANT",
    eventType: "SIGNATURE_ETUDIANT_DEMARREE",
    eventComment:
      "Le contrat a ete envoye a Documenso pour la signature de l'etudiant.",
    notification: {
      title: "Signature etudiante requise",
      message:
        "Votre contrat de stage est pret. Signez votre partie avec Documenso.",
      type: "SIGNATURE_ETUDIANT_REQUISE",
      userIds: [studentId],
      contractId: contract.id,
      actionUrl: `/contracts/${contract.id}`
    }
  });

  return getStudentContractById(studentId, contractId);
}

export async function getStudentContractFile(
  studentId,
  contractId,
  type
) {
  const contract = await findStudentContractById(
    db,
    studentId,
    contractId
  );

  const pathColumn =
    type === "signed"
      ? contract.pdfSignedPath
      : contract.pdfStudentSignedPath ||
        contract.pdfOriginalPath ||
        contract.generatedFilePath;

  if (!pathColumn) {
    throw createError(
      "Aucun fichier PDF n'est disponible pour ce contrat.",
      404
    );
  }

  if (
    type === "signed" &&
    contract.status !== "DOSSIER_COMPLET"
  ) {
    throw createError(
      "Le PDF signe sera disponible lorsque toutes les signatures seront terminees.",
      400
    );
  }

  const absolutePath =
    resolveContractStoragePath(pathColumn);
  await assertValidPdf(absolutePath);

  return {
    absolutePath,
    fileName: path.basename(absolutePath)
  };
}

export async function uploadMilieuSignedContract(
  studentId,
  contractId,
  uploadedFile
) {
  const normalizedFile =
    validateMilieuSignedContractFile(uploadedFile);
  const contract = await findStudentContractById(
    db,
    studentId,
    contractId
  );

  if (contract.status !== "CONTRAT_MILIEU_A_DEPOSER") {
    throw createError(
      "Le contrat signe par le milieu peut etre depose seulement apres la signature de l'etudiant.",
      400
    );
  }

  const confirmationCode =
    await generateUniqueConfirmationCode(db);
  const storedFile = await saveUploadedContractPdf(
    contract,
    normalizedFile,
    "milieu"
  );

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE contrats
        SET
          chemin_fichier_televerse = ?,
          milieu_signe_recu_le = NOW(),
          code_confirmation_reception = ?,
          statut = 'SIGNATURE_SUPERVISEUR'
        WHERE id = ?
      `,
      [
        storedFile.relativePath,
        confirmationCode,
        contract.id
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'ATTENTE_SIGNATURE'
        WHERE id = ?
      `,
      [contract.folderId]
    );

    await connection.execute(
      `
        UPDATE signatures_contrat
        SET
          statut = 'SIGNE',
          signe_le = COALESCE(signe_le, NOW()),
          fournisseur_signature = 'AUTRE'
        WHERE contrat_id = ?
          AND role_signataire = 'ENTREPRISE'
      `,
      [contract.id]
    );

    await saveDocumentRecord(connection, {
      folderId: contract.folderId,
      contractId: contract.id,
      userId: studentId,
      type: "CONTRAT_SIGNE_MILIEU",
      fileName: normalizedFile.safeFileName,
      filePath: storedFile.relativePath,
      mimeType: normalizedFile.mimeType,
      size: normalizedFile.size,
      confirmationCode,
      status: "VALIDE"
    });

    await createWorkflowEvent(connection, {
      folderId: contract.folderId,
      actorId: studentId,
      eventType: "CONTRAT_SIGNE_MILIEU_RECU",
      oldStatus: contract.status,
      newStatus: "SIGNATURE_SUPERVISEUR",
      comment: `Contrat signe par le milieu recu. Code de confirmation : ${confirmationCode}.`
    });

    await createNotificationForUsers(connection, {
      title: "Contrat signe par le milieu recu",
      message: `Le contrat signe par le milieu pour ${fullStudentName(contract) || "un etudiant"} a ete depose. Une signature enseignant est requise.`,
      type: "CONTRAT_MILIEU_RECU",
      contractId: contract.id,
      actionUrl: `/stage-management/contracts/${contract.id}`,
      userIds: [contract.teacherId]
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  let documensoWarning = "";

  if (isDocumensoConfigured()) {
    try {
      await startAdministrativeSignatureWorkflow(
        contract.id,
        studentId,
        storedFile.relativePath
      );
    } catch (error) {
      documensoWarning = error.message;
    }
  } else {
    documensoWarning = getDocumensoConfigMessage();
  }

  const updatedContract = await getStudentContractById(
    studentId,
    contractId
  );

  return {
    ...updatedContract,
    receipt: {
      confirmationCode,
      receivedAt:
        updatedContract.milieuSignedReceivedAt,
      fileName: normalizedFile.safeFileName,
      status: updatedContract.status,
      nextStep:
        "Signature electronique de l'enseignant"
    },
    documensoWarning
  };
}

export async function getStudentContractReceipt(
  studentId,
  contractId
) {
  const contract = await findStudentContractById(
    db,
    studentId,
    contractId
  );

  if (!contract.confirmationCode) {
    throw createError(
      "Aucun recu de reception n'est disponible pour ce contrat.",
      404
    );
  }

  const [documentRows] = await db.execute(
    `
      SELECT
        nom_fichier AS fileName,
        cree_le AS receivedAt
      FROM documents
      WHERE contrat_id = ?
        AND type_document = 'CONTRAT_SIGNE_MILIEU'
        AND code_confirmation = ?
      ORDER BY version_document DESC
      LIMIT 1
    `,
    [contract.id, contract.confirmationCode]
  );
  const document = documentRows[0] || {};

  return {
    confirmationCode: contract.confirmationCode,
    receivedAt:
      contract.milieuSignedReceivedAt ||
      document.receivedAt,
    fileName: document.fileName || "-",
    status: contract.status,
    nextStep:
      contract.status === "DOSSIER_COMPLET"
        ? "Dossier complet"
        : "Signature electronique interne"
  };
}

export function validateMilieuSignedContractFile(
  file = {}
) {
  const originalName = String(file.originalName || "");
  const mimeType = String(file.mimeType || "").toLowerCase();
  const buffer = file.buffer;
  const size = Number(file.size || buffer?.length || 0);

  if (!buffer || !Buffer.isBuffer(buffer) || size <= 0) {
    throw createError(
      "Le fichier PDF du contrat signe est obligatoire.",
      400
    );
  }

  if (size > MAX_MILIEU_SIGNED_PDF_SIZE_BYTES) {
    throw createError(
      "Le contrat signe depasse la taille maximale autorisee.",
      413
    );
  }

  if (
    mimeType !== "application/pdf" ||
    !originalName.toLowerCase().endsWith(".pdf") ||
    buffer.slice(0, 5).toString("ascii") !== "%PDF-"
  ) {
    throw createError(
      "Le contrat signe doit etre un fichier PDF valide.",
      400
    );
  }

  return {
    originalName,
    safeFileName: sanitizeFileName(originalName),
    mimeType,
    size,
    buffer
  };
}

export function generateConfirmationCodeValue(
  date = new Date(),
  randomBytes = crypto.randomBytes(4)
) {
  const year = date.getFullYear();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";

  for (const byte of randomBytes) {
    randomPart += alphabet[byte % alphabet.length];
  }

  while (randomPart.length < 6) {
    randomPart += alphabet[
      crypto.randomInt(0, alphabet.length)
    ];
  }

  return `STG-${year}-${randomPart.slice(0, 6)}`;
}

async function startAdministrativeSignatureWorkflow(
  contractId,
  actorId,
  relativePdfPath
) {
  const contract = await findContractById(db, contractId);
  const signers = (
    await getContractSigners(db, contractId)
  ).filter((signer) =>
    administrativeSignerRoles.includes(signer.role)
  );

  validateSigners(signers);

  const externalId =
    contract.externalId ||
    makeContractExternalId(contract);
  const absolutePath =
    resolveContractStoragePath(relativePdfPath);
  await assertValidPdf(absolutePath);

  const documensoDocument =
    await createAndSendDocument({
      pdfPath: absolutePath,
      title: `Contrat de stage - signatures internes - ${
        contract.companyName || contract.id
      }`,
      externalId,
      recipients: signers.map((signer, index) => ({
        signingOrder: index + 1,
        role: signer.role,
        name: signer.name,
        email: signer.email
      }))
    });

  await saveDocumensoPhaseSubmission({
    actorId,
    contract,
    signers,
    pdf: null,
    documensoDocument,
    externalId,
    newStatus: "SIGNATURE_SUPERVISEUR",
    eventType: "SIGNATURE_ENSEIGNANT_DEMARREE",
    eventComment:
      "La signature electronique de l'enseignant a ete lancee automatiquement apres le depot du contrat signe par le milieu.",
    notification: {
      title: "Signature enseignant requise",
      message:
        "Un contrat de stage attend votre signature electronique.",
      type: "SIGNATURE_ENSEIGNANT_REQUISE",
      contractId,
      actionUrl: `/stage-management/contracts/${contractId}`,
      userIds: [signers[0]?.userId]
    }
  });
}

async function saveUploadedContractPdf(
  contract,
  file,
  suffix
) {
  const fileName = makeStoredPdfFileName(
    contract,
    suffix
  );
  const relativePath = path.join("uploaded", fileName);
  const absolutePath =
    resolveContractStoragePath(relativePath);

  await fs.mkdir(path.dirname(absolutePath), {
    recursive: true
  });
  await fs.writeFile(absolutePath, file.buffer);
  await assertValidPdf(absolutePath);

  return {
    fileName,
    relativePath: normalizeStoragePath(relativePath),
    absolutePath
  };
}

async function generateUniqueConfirmationCode(connection) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateConfirmationCodeValue();
    const [rows] = await connection.execute(
      `
        SELECT id
        FROM contrats
        WHERE code_confirmation_reception = ?
        LIMIT 1
      `,
      [code]
    );

    if (!rows[0]) {
      return code;
    }
  }

  throw createError(
    "Impossible de generer un code de confirmation unique.",
    500
  );
}

function makeStoredPdfFileName(contract, suffix) {
  const idPart = String(
    contract.externalId || `contrat-${contract.id}`
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const randomPart = crypto
    .randomBytes(4)
    .toString("hex");

  return `${idPart}-${suffix}-${timestamp}-${randomPart}.pdf`;
}

function normalizeStoragePath(value) {
  return value.split(path.sep).join("/");
}

export async function syncContractSignersForContract(
  connection,
  contractId,
  { resetStatus = false } = {}
) {
  const source = await getSignerSource(
    connection,
    contractId
  );

  const signers = [
    {
      signingOrder: 1,
      role: "ETUDIANT",
      userId: source.studentId,
      signatureProvider: "DOCUMENSO",
      name: joinName(
        source.studentFirstName,
        source.studentLastName
      ),
      email: source.studentEmail
    },
    {
      signingOrder: 2,
      role: "ENTREPRISE",
      userId: null,
      signatureProvider: "AUTRE",
      name: firstValue(
        source.companySignatureName,
        source.companySupervisorName,
        source.companyName
      ),
      email: firstValue(
        source.companySignatureEmail,
        source.companySupervisorEmail,
        source.companyEmail
      )
    },
    {
      signingOrder: 3,
      role: "SUPERVISEUR",
      userId: source.teacherId,
      signatureProvider: "DOCUMENSO",
      name: joinName(
        source.teacherFirstName,
        source.teacherLastName
      ),
      email: source.teacherEmail
    },
    {
      signingOrder: 4,
      role: "CONSEILLERE",
      userId: source.counsellorId,
      signatureProvider: "DOCUMENSO",
      name: joinName(
        source.counsellorFirstName,
        source.counsellorLastName
      ),
      email: source.counsellorEmail
    },
    {
      signingOrder: 5,
      role: "DIRECTION",
      userId: source.directionId,
      signatureProvider: "DOCUMENSO",
      name: joinName(
        source.directionFirstName,
        source.directionLastName
      ),
      email: source.directionEmail
    }
  ];

  await moveExistingSignerOrders(connection, contractId);

  for (const signer of signers) {
    await connection.execute(
      `
        INSERT INTO signatures_contrat (
          contrat_id,
          ordre_signature,
          role_signataire,
          utilisateur_signataire_id,
          nom_signataire,
          courriel_signataire,
          statut,
          fournisseur_signature
        )
        VALUES (?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?)
        ON DUPLICATE KEY UPDATE
          ordre_signature = VALUES(ordre_signature),
          utilisateur_signataire_id =
            VALUES(utilisateur_signataire_id),
          nom_signataire = VALUES(nom_signataire),
          courriel_signataire = VALUES(courriel_signataire),
          statut = CASE
            WHEN ? THEN 'EN_ATTENTE'
            ELSE statut
          END,
          fournisseur_signature =
            VALUES(fournisseur_signature)
      `,
      [
        contractId,
        signer.signingOrder,
        signer.role,
        signer.userId,
        signer.name || "-",
        signer.email || "",
        signer.signatureProvider || "DOCUMENSO",
        resetStatus ? 1 : 0
      ]
    );
  }

  return getContractSigners(connection, contractId);
}

export function verifyDocumensoWebhookSecret(req) {
  const expectedSecret = String(
    process.env.DOCUMENSO_WEBHOOK_SECRET || ""
  );

  if (!expectedSecret) {
    throw createError(
      "Le secret webhook Documenso n'est pas configure.",
      503
    );
  }

  const receivedSecret = String(
    req.get("X-Documenso-Secret") ||
      req.get("x-documenso-secret") ||
      ""
  );

  if (!receivedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret);
  const receivedBuffer = Buffer.from(receivedSecret);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

export async function processDocumensoWebhook(body) {
  const normalizedEvent =
    normalizeDocumensoWebhookEvent(body);

  if (!normalizedEvent.type) {
    throw createError(
      "Evenement Documenso invalide.",
      400
    );
  }

  if (!documensoEventStatuses[normalizedEvent.type]) {
    return { ignored: true, reason: "unsupported_event" };
  }

  const connection = await db.getConnection();
  let completedDocumensoPhase = null;

  try {
    await connection.beginTransaction();

    const inserted = await insertWebhookEvent(
      connection,
      normalizedEvent
    );

    if (!inserted) {
      await connection.commit();
      return { ignored: true, reason: "duplicate_event" };
    }

    const contract =
      await findContractForWebhook(
        connection,
        normalizedEvent
      );

    if (!contract) {
      await connection.commit();
      return { ignored: true, reason: "contract_not_found" };
    }

    await updateContractFromDocumensoEvent(
      connection,
      contract,
      normalizedEvent
    );

    if (normalizedEvent.type === "DOCUMENT_COMPLETED") {
      completedDocumensoPhase = {
        contract,
        type:
          contract.status === "SIGNATURE_ETUDIANT"
            ? "student"
            : "final"
      };
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (
    completedDocumensoPhase &&
    normalizedEvent.documentId &&
    isDocumensoConfigured()
  ) {
    await downloadAndSaveDocumensoPdf(
      completedDocumensoPhase.contract.id,
      normalizedEvent.documentId,
      completedDocumensoPhase.type
    ).catch((error) => {
      console.error(error);
    });
  }

  return { ok: true };
}

export function normalizeDocumensoWebhookEvent(body = {}) {
  const payload =
    body.payload ||
    body.data ||
    body.document ||
    body.envelope ||
    {};

  const type = normalizeDocumensoEventType(
    firstValue(
      body.event,
      body.type,
      body.eventType,
      body.event_type
    )
  );

  const documentId = firstValue(
    payload.id,
    payload.documentId,
    payload.envelopeId,
    payload.document?.id,
    body.documentId,
    body.envelopeId
  );

  const externalId = firstValue(
    payload.externalId,
    payload.external_id,
    payload.metadata?.externalId,
    body.externalId,
    body.external_id
  );

  const recipients = normalizeWebhookRecipients(
    firstValue(
      payload.recipients,
      payload.signers,
      body.recipients
    )
  );

  const eventKey = firstValue(
    body.id,
    body.eventId,
    body.webhookEventId
  ) || createEventHash(body);

  return {
    type,
    eventKey,
    payload,
    recipients,
    documentId: documentId ? String(documentId) : "",
    externalId: externalId ? String(externalId) : ""
  };
}

async function saveDocumensoPhaseSubmission({
  actorId,
  contract,
  signers,
  pdf = null,
  documensoDocument,
  externalId,
  newStatus,
  eventType,
  eventComment,
  notification = null
}) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE contrats
        SET
          external_id = ?,
          chemin_fichier_genere = COALESCE(?, chemin_fichier_genere),
          pdf_original_path = COALESCE(?, pdf_original_path),
          fournisseur_signature = 'DOCUMENSO',
          enveloppe_externe_id = ?,
          document_externe_id = ?,
          documenso_document_id = ?,
          documenso_status = ?,
          statut = ?,
          url_signature = NULL,
          genere_le = COALESCE(genere_le, ?),
          submitted_at = COALESCE(submitted_at, NOW())
        WHERE id = ?
      `,
      [
        externalId,
        pdf?.relativePath || null,
        pdf?.relativePath || null,
        documensoDocument.envelopeId,
        documensoDocument.documentItemId ||
          documensoDocument.envelopeId,
        documensoDocument.envelopeId,
        documensoDocument.status,
        newStatus,
        pdf ? new Date() : null,
        contract.id
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'ATTENTE_SIGNATURE'
        WHERE id = ?
      `,
      [contract.folderId]
    );

    const signerIds = new Set(
      signers.map((signer) => Number(signer.id))
    );

    for (const signer of signers) {
      const remoteRecipient =
        documensoDocument.recipients.find(
          (recipient) =>
            sameEmail(recipient.email, signer.email) ||
            Number(recipient.signingOrder) ===
              Number(signer.signingOrder)
        ) || {};

      await connection.execute(
        `
          UPDATE signatures_contrat
          SET
            signature_externe_id = ?,
            url_signature = ?,
            statut = ?,
            fournisseur_signature = 'DOCUMENSO'
          WHERE id = ?
        `,
          [
          remoteRecipient.documensoRecipientId || null,
          remoteRecipient.signingUrl || null,
          signer === signers[0]
            ? "ENVOYE"
            : "EN_ATTENTE",
          signer.id
        ]
      );
    }

    if (signerIds.size) {
      await connection.execute(
        `
          UPDATE signatures_contrat
          SET statut = 'EN_ATTENTE'
          WHERE contrat_id = ?
            AND id NOT IN (${[...signerIds]
              .map(() => "?")
              .join(", ")})
            AND statut <> 'SIGNE'
        `,
        [contract.id, ...signerIds]
      );
    }

    if (pdf) {
      await saveDocumentRecord(connection, {
        folderId: contract.folderId,
        contractId: contract.id,
        userId: actorId,
        type: "CONTRAT_GENERE",
        fileName: pdf.fileName,
        filePath: pdf.relativePath,
        mimeType: "application/pdf",
        size: null,
        status: "DEPOSE"
      });
    }

    await createWorkflowEvent(connection, {
      folderId: contract.folderId,
      actorId,
      eventType,
      oldStatus: contract.status,
      newStatus,
      comment: eventComment
    });

    if (notification) {
      await createNotificationForUsers(
        connection,
        notification
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findContractsForStudent(
  connection,
  studentId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        ${contractSelectColumns()}

      FROM contrats c

      INNER JOIN demandes_stage d
        ON d.id = c.demande_stage_id

      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      WHERE ds.etudiant_id = ?

      ORDER BY c.cree_le DESC
    `,
    [studentId]
  );

  return rows;
}

async function findStudentContractById(
  connection,
  studentId,
  contractId,
  forUpdate = false
) {
  const [rows] = await connection.execute(
    `
      SELECT
        ${contractSelectColumns()}

      FROM contrats c

      INNER JOIN demandes_stage d
        ON d.id = c.demande_stage_id

      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      WHERE c.id = ?
        AND ds.etudiant_id = ?

      LIMIT 1
      ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [contractId, studentId]
  );

  const contract = rows[0];

  if (!contract) {
    throw createError(
      "Contrat introuvable ou acces refuse.",
      404
    );
  }

  return contract;
}

async function findContractById(connection, contractId) {
  const [rows] = await connection.execute(
    `
      SELECT
        ${contractSelectColumns()}

      FROM contrats c

      INNER JOIN demandes_stage d
        ON d.id = c.demande_stage_id

      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      WHERE c.id = ?

      LIMIT 1
    `,
    [contractId]
  );

  if (!rows[0]) {
    throw createError("Contrat introuvable.", 404);
  }

  return rows[0];
}

function contractSelectColumns() {
  return `
    c.id,
    c.dossier_stage_id AS folderId,
    c.demande_stage_id AS requestId,
    c.external_id AS externalId,
    c.annee_scolaire AS schoolYear,
    c.session,
    c.code_programme AS codeProgram,
    c.fonction_stage AS functionStage,
    c.description_stage AS descriptionStage,
    c.est_remunere AS isPaid,
    c.salaire_horaire AS hourlySalary,
    c.compensation_monetaire AS monetaryCompensation,
    c.autre_compensation AS otherCompensation,
    c.heures_semaine AS hoursPerWeek,
    c.nombre_semaines AS numberOfWeeks,
    c.total_heures AS totalHours,
    c.type_horaire AS scheduleType,
    c.statut AS status,
    c.chemin_fichier_genere AS generatedFilePath,
    c.chemin_fichier_televerse AS uploadedFilePath,
    c.pdf_original_path AS pdfOriginalPath,
    c.pdf_etudiant_signe_path AS pdfStudentSignedPath,
    c.pdf_signed_path AS pdfSignedPath,
    c.milieu_signe_recu_le AS milieuSignedReceivedAt,
    c.code_confirmation_reception AS confirmationCode,
    c.fournisseur_signature AS signatureProvider,
    c.enveloppe_externe_id AS externalEnvelopeId,
    c.document_externe_id AS externalDocumentId,
    c.documenso_document_id AS documensoDocumentId,
    c.documenso_status AS documensoStatus,
    c.genere_le AS generatedAt,
    c.complete_le AS completedAtLegacy,
    c.submitted_at AS submittedAt,
    c.completed_at AS completedAt,
    c.rejected_at AS rejectedAt,
    c.cree_le AS createdAt,

    d.resume_taches AS taskSummary,
    d.date_debut AS startDate,
    d.date_fin AS endDate,
    d.horaire_stage AS workSchedule,
    d.statut AS requestStatus,

    ds.statut AS folderStatus,

    student_user.id AS studentId,
    student_user.prenom AS studentFirstName,
    student_user.nom AS studentLastName,
    student_user.courriel AS studentEmail,
    student_user.telephone AS studentPhone,
    etu.code_etudiant AS studentCode,
    etu.code_permanent AS studentPermanentCode,
    etu.programme AS program,
    etu.groupe AS studentGroup,
    etu.adresse AS studentAddress,
    etu.ville AS studentCity,
    etu.province AS studentProvince,
    etu.code_postal AS studentPostalCode,

    teacher_user.id AS teacherId,
    teacher_user.prenom AS teacherFirstName,
    teacher_user.nom AS teacherLastName,
    teacher_user.courriel AS teacherEmail,

    ent.id AS companyId,
    ent.nom AS companyName,
    ent.neq AS companyNeq,
    ent.adresse AS companyAddress,
    ent.ville AS companyCity,
    ent.province AS companyProvince,
    ent.code_postal AS companyPostalCode,
    ent.telephone AS companyPhone,
    ent.poste_telephonique AS companyPhoneExtension,
    ent.courriel AS companyEmail,
    ent.site_web AS companyWebsite,
    ent.type_organisation AS organizationType,
    ent.secteur_activite AS businessSector,
    ent.contact_signature_nom AS companySignatureName,
    ent.contact_signature_courriel AS companySignatureEmail,
    ent.superviseur_nom AS companySupervisorName,
    ent.superviseur_titre AS companySupervisorTitle,
    ent.superviseur_courriel AS companySupervisorEmail,
    ent.superviseur_telephone AS companySupervisorPhone
  `;
}

async function getSignerSource(connection, contractId) {
  const [rows] = await connection.execute(
    `
      SELECT
        c.id,
        ds.etudiant_id AS studentId,
        student_user.prenom AS studentFirstName,
        student_user.nom AS studentLastName,
        student_user.courriel AS studentEmail,

        ds.superviseur_id AS teacherId,
        teacher_user.prenom AS teacherFirstName,
        teacher_user.nom AS teacherLastName,
        teacher_user.courriel AS teacherEmail,

        ent.nom AS companyName,
        ent.courriel AS companyEmail,
        ent.contact_signature_nom AS companySignatureName,
        ent.contact_signature_courriel AS companySignatureEmail,
        ent.superviseur_nom AS companySupervisorName,
        ent.superviseur_courriel AS companySupervisorEmail,

        counsellor_user.id AS counsellorId,
        counsellor_user.prenom AS counsellorFirstName,
        counsellor_user.nom AS counsellorLastName,
        counsellor_user.courriel AS counsellorEmail,

        direction_user.id AS directionId,
        direction_user.prenom AS directionFirstName,
        direction_user.nom AS directionLastName,
        direction_user.courriel AS directionEmail

      FROM contrats c

      INNER JOIN demandes_stage d
        ON d.id = c.demande_stage_id

      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      LEFT JOIN utilisateurs counsellor_user
        ON counsellor_user.id = (
          SELECT id
          FROM utilisateurs
          WHERE role = 'CONSEILLERE'
            AND statut = 'ACTIF'
          ORDER BY id
          LIMIT 1
        )

      LEFT JOIN utilisateurs direction_user
        ON direction_user.id = (
          SELECT id
          FROM utilisateurs
          WHERE role = 'DIRECTION'
            AND statut = 'ACTIF'
          ORDER BY id
          LIMIT 1
        )

      WHERE c.id = ?
      LIMIT 1
    `,
    [contractId]
  );

  if (!rows[0]) {
    throw createError("Contrat introuvable.", 404);
  }

  return rows[0];
}

async function moveExistingSignerOrders(
  connection,
  contractId
) {
  await connection.execute(
    `
      UPDATE signatures_contrat
      SET ordre_signature = ordre_signature + 100
      WHERE contrat_id = ?
        AND ordre_signature IN (1, 2, 3, 4, 5)
    `,
    [contractId]
  );
}

async function getContractSigners(
  connection,
  contractId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        ordre_signature AS signingOrder,
        role_signataire AS role,
        utilisateur_signataire_id AS userId,
        nom_signataire AS name,
        courriel_signataire AS email,
        statut AS status,
        fournisseur_signature AS signatureProvider,
        signature_externe_id AS documensoRecipientId,
        url_signature AS signingUrl,
        signe_le AS signedAt
      FROM signatures_contrat
      WHERE contrat_id = ?
        AND role_signataire IN (
          'ETUDIANT',
          'ENTREPRISE',
          'SUPERVISEUR',
          'CONSEILLERE',
          'DIRECTION'
        )
      ORDER BY ordre_signature ASC
    `,
    [contractId]
  );

  return rows.map(formatSigner);
}

function formatContract(row) {
  return {
    ...row,
    isPaid: Boolean(row.isPaid),
    documensoConfigured: isDocumensoConfigured(),
    documensoMessage: getDocumensoConfigMessage(),
    generatedPdfAvailable: Boolean(
      row.pdfOriginalPath || row.generatedFilePath
    ),
    studentSignedPdfAvailable: Boolean(
      row.pdfStudentSignedPath
    ),
    milieuSignedPdfAvailable: Boolean(
      row.uploadedFilePath
    ),
    signedPdfAvailable: Boolean(
      row.pdfSignedPath
    )
  };
}

function formatSigner(row) {
  return {
    ...row,
    signingOrder: Number(row.signingOrder),
    label: signerRoleLabel(row.role)
  };
}

function ensureContractCanBeEdited(contract) {
  if (contract.status !== "A_COMPLETER_ETUDIANT") {
    throw createError(
      "Ce contrat ne peut plus etre modifie.",
      400
    );
  }
}

export function validateContractData(
  data = {},
  current = {}
) {
  const cleanedData = {
    schoolYear: clean(
      data.schoolYear ?? current.schoolYear
    ),
    session: clean(data.session ?? current.session),
    codeProgram: clean(
      data.codeProgram ?? current.codeProgram
    ),
    functionStage: clean(
      data.functionStage ?? current.functionStage
    ),
    descriptionStage: clean(
      data.descriptionStage ??
        current.descriptionStage
    ),
    isPaid: Boolean(data.isPaid ?? current.isPaid),
    hourlySalary: null,
    monetaryCompensation: optional(
      data.monetaryCompensation ??
        current.monetaryCompensation
    ),
    otherCompensation: optional(
      data.otherCompensation ??
        current.otherCompensation
    ),
    hoursPerWeek: toPositiveNumber(
      data.hoursPerWeek ?? current.hoursPerWeek,
      "Le nombre d'heures par semaine"
    ),
    numberOfWeeks: toPositiveNumber(
      data.numberOfWeeks ?? current.numberOfWeeks,
      "Le nombre de semaines"
    ),
    scheduleType: clean(
      data.scheduleType ?? current.scheduleType
    )
  };

  const requiredFields = [
    ["L'annee scolaire", cleanedData.schoolYear],
    ["La session", cleanedData.session],
    ["Le code de programme", cleanedData.codeProgram],
    ["La fonction de stage", cleanedData.functionStage],
    [
      "La description du stage",
      cleanedData.descriptionStage
    ]
  ];

  for (const [label, value] of requiredFields) {
    if (!value) {
      throw createError(`${label} est obligatoire.`, 400);
    }
  }

  const allowedScheduleTypes = [
    "TEMPS_PARTIEL",
    "TEMPS_PLEIN"
  ];

  if (
    !allowedScheduleTypes.includes(
      cleanedData.scheduleType
    )
  ) {
    throw createError(
      "Le type d'horaire est invalide.",
      400
    );
  }

  if (cleanedData.isPaid) {
    cleanedData.hourlySalary = toNonNegativeNumber(
      data.hourlySalary ?? current.hourlySalary,
      "Le salaire horaire"
    );
  }

  cleanedData.totalHours = Number(
    (
      cleanedData.hoursPerWeek *
      cleanedData.numberOfWeeks
    ).toFixed(2)
  );

  return cleanedData;
}

function validateContractReadyForSubmission(contract) {
  validateContractData({}, contract);
}

function validateSigners(signers) {
  if (!signers.length) {
    throw createError(
      "Aucun signataire Documenso n'est disponible.",
      400
    );
  }

  signers.forEach((signer) => {
    if (!signer.name || signer.name === "-") {
      throw createError(
        `Le nom du signataire ${signerRoleLabel(signer.role)} est manquant.`,
        400
      );
    }

    if (!isValidEmail(signer.email)) {
      throw createError(
        `Le courriel du signataire ${signerRoleLabel(signer.role)} est invalide.`,
        400
      );
    }
  });
}

async function saveDocumentRecord(
  connection,
  {
    folderId,
    contractId,
    userId,
    type,
    fileName,
    filePath,
    mimeType = null,
    size = null,
    confirmationCode = null,
    status
  }
) {
  const [versionRows] = await connection.execute(
    `
      SELECT COALESCE(MAX(version_document), 0) + 1 AS nextVersion
      FROM documents
      WHERE contrat_id = ?
        AND type_document = ?
    `,
    [contractId, type]
  );

  await connection.execute(
    `
      INSERT INTO documents (
        dossier_stage_id,
        contrat_id,
        depose_par_utilisateur_id,
        type_document,
        nom_fichier,
        chemin_fichier,
        type_mime,
        taille_octets,
        code_confirmation,
        version_document,
        statut
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      folderId,
      contractId,
      userId,
      type,
      fileName,
      filePath,
      mimeType,
      size,
      confirmationCode,
      versionRows[0]?.nextVersion || 1,
      status
    ]
  );
}

async function createWorkflowEvent(
  connection,
  {
    folderId,
    actorId,
    eventType,
    oldStatus,
    newStatus,
    comment
  }
) {
  await connection.execute(
    `
      INSERT INTO evenements_workflow (
        dossier_stage_id,
        utilisateur_acteur_id,
        type_evenement,
        ancien_statut,
        nouveau_statut,
        commentaire
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      folderId,
      actorId,
      eventType,
      oldStatus,
      newStatus,
      comment
    ]
  );
}

async function insertWebhookEvent(
  connection,
  event
) {
  try {
    await connection.execute(
      `
        INSERT INTO documenso_webhook_events (
          event_key,
          event_type,
          documenso_document_id,
          external_id
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        event.eventKey,
        event.type,
        event.documentId || null,
        event.externalId || null
      ]
    );

    return true;
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return false;
    }

    throw error;
  }
}

async function findContractForWebhook(
  connection,
  event
) {
  const values = [
    event.externalId || null,
    event.documentId || null,
    event.documentId || null,
    event.documentId || null
  ];

  const [rows] = await connection.execute(
    `
      SELECT
        c.id,
        c.dossier_stage_id AS folderId,
        c.statut AS status,
        c.external_id AS externalId,
        c.documenso_document_id AS documensoDocumentId,
        ds.etudiant_id AS studentId
      FROM contrats c
      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id
      WHERE c.external_id = ?
        OR c.documenso_document_id = ?
        OR c.enveloppe_externe_id = ?
        OR c.document_externe_id = ?
      LIMIT 1
    `,
    values
  );

  return rows[0] || null;
}

async function updateContractFromDocumensoEvent(
  connection,
  contract,
  event
) {
  const documensoStatus =
    documensoEventStatuses[event.type];

  await connection.execute(
    `
      UPDATE contrats
      SET documenso_status = ?
      WHERE id = ?
    `,
    [documensoStatus, contract.id]
  );

  await updateSignersFromWebhook(
    connection,
    contract.id,
    event.recipients
  );

  if (
    event.type === "DOCUMENT_REJECTED" ||
    event.type === "DOCUMENT_CANCELLED"
  ) {
    await markContractRejected(
      connection,
      contract,
      documensoStatus
    );
    return;
  }

  if (
    contract.status === "SIGNATURE_ETUDIANT" &&
    await areRolesSigned(connection, contract.id, [
      "ETUDIANT"
    ])
  ) {
    await markStudentSignatureCompleted(
      connection,
      contract
    );
    return;
  }

  if (
    event.type === "DOCUMENT_COMPLETED" &&
    await areRolesSigned(
      connection,
      contract.id,
      administrativeSignerRoles
    )
  ) {
    await markContractCompleted(connection, contract);
    return;
  }

  if (
    event.type === "DOCUMENT_SENT" ||
    event.type === "DOCUMENT_OPENED" ||
    event.type === "DOCUMENT_SIGNED" ||
    event.type === "DOCUMENT_RECIPIENT_COMPLETED"
  ) {
    await moveContractToNextSigner(
      connection,
      contract
    );
  }
}

async function updateSignersFromWebhook(
  connection,
  contractId,
  recipients
) {
  for (const recipient of recipients) {
    const status =
      mapDocumensoRecipientStatus(recipient);

    if (!status) {
      continue;
    }

    const signedAt =
      status === "SIGNE"
        ? firstValue(
            recipient.signedAt,
            recipient.signed_at,
            recipient.completedAt
          )
        : null;

    const params = [
      status,
      signedAt,
      recipient.id || null,
      contractId,
      recipient.id || null,
      recipient.email || ""
    ];

    await connection.execute(
      `
        UPDATE signatures_contrat
        SET
          statut = ?,
          signe_le = COALESCE(?, signe_le),
          signature_externe_id =
            COALESCE(signature_externe_id, ?)
        WHERE contrat_id = ?
          AND (
            signature_externe_id = ?
            OR LOWER(courriel_signataire) = LOWER(?)
          )
      `,
      params
    );
  }
}

async function moveContractToNextSigner(
  connection,
  contract
) {
  const signers = (
    await getContractSigners(
      connection,
      contract.id
    )
  ).filter((signer) =>
    administrativeSignerRoles.includes(signer.role)
  );

  const refusedSigner = signers.find(
    (signer) => signer.status === "REFUSE"
  );

  if (refusedSigner) {
    await markContractRejected(
      connection,
      contract,
      "REJECTED"
    );
    return;
  }

  const nextSigner = signers.find(
    (signer) => signer.status !== "SIGNE"
  );

  if (!nextSigner) {
    await markContractCompleted(connection, contract);
    return;
  }

  const nextStatus =
    contractStatusBySignerRole[nextSigner.role] ||
    contract.status;

  await connection.execute(
    `
      UPDATE signatures_contrat
      SET statut = 'ENVOYE'
      WHERE id = ?
        AND statut = 'EN_ATTENTE'
    `,
    [nextSigner.id]
  );

  await connection.execute(
    `
      UPDATE contrats
      SET statut = ?
      WHERE id = ?
    `,
    [nextStatus, contract.id]
  );

  await connection.execute(
    `
      UPDATE dossiers_stage
      SET statut = 'ATTENTE_SIGNATURE'
      WHERE id = ?
    `,
    [contract.folderId]
  );

  if (nextSigner.userId) {
    await createNotificationForUsers(connection, {
      title: "Signature de contrat requise",
      message:
        "Un contrat de stage attend votre signature.",
      type: "SIGNATURE_CONTRAT",
      userIds: [nextSigner.userId]
    });
  }
}

async function markStudentSignatureCompleted(
  connection,
  contract
) {
  await connection.execute(
    `
      UPDATE contrats
      SET statut = 'CONTRAT_MILIEU_A_DEPOSER'
      WHERE id = ?
    `,
    [contract.id]
  );

  await connection.execute(
    `
      UPDATE dossiers_stage
      SET statut = 'ATTENTE_SIGNATURE'
      WHERE id = ?
    `,
    [contract.folderId]
  );

  await createWorkflowEvent(connection, {
    folderId: contract.folderId,
    actorId: contract.studentId,
    eventType: "SIGNATURE_ETUDIANT_CONFIRMEE",
    oldStatus: contract.status,
    newStatus: "CONTRAT_MILIEU_A_DEPOSER",
    comment:
      "La signature de l'etudiant a ete confirmee par Documenso."
  });

  await createNotificationForUsers(connection, {
    title: "Contrat du milieu a deposer",
    message:
      "Votre signature est confirmee. Faites signer le contrat par le milieu de stage puis deposez le PDF signe.",
    type: "CONTRAT_MILIEU_A_DEPOSER",
    contractId: contract.id,
    actionUrl: `/contracts/${contract.id}`,
    userIds: [contract.studentId]
  });
}

async function areRolesSigned(
  connection,
  contractId,
  roles
) {
  const [rows] = await connection.execute(
    `
      SELECT COUNT(*) AS missingCount
      FROM signatures_contrat
      WHERE contrat_id = ?
        AND role_signataire IN (${roles
          .map(() => "?")
          .join(", ")})
        AND statut <> 'SIGNE'
    `,
    [contractId, ...roles]
  );

  return Number(rows[0]?.missingCount || 0) === 0;
}

async function markContractCompleted(
  connection,
  contract
) {
  await connection.execute(
    `
      UPDATE signatures_contrat
      SET
        statut = 'SIGNE',
        signe_le = COALESCE(signe_le, NOW())
      WHERE contrat_id = ?
        AND role_signataire IN (
          'ETUDIANT',
          'ENTREPRISE',
          'SUPERVISEUR',
          'CONSEILLERE',
          'DIRECTION'
        )
    `,
    [contract.id]
  );

  await connection.execute(
    `
      UPDATE contrats
      SET
        statut = 'DOSSIER_COMPLET',
        documenso_status = 'COMPLETED',
        complete_le = NOW(),
        completed_at = NOW()
      WHERE id = ?
    `,
    [contract.id]
  );

  await connection.execute(
    `
      UPDATE dossiers_stage
      SET statut = 'DOSSIER_COMPLET'
      WHERE id = ?
    `,
    [contract.folderId]
  );

  await createNotificationForUsers(connection, {
    title: "Dossier de stage complet",
    message:
      "Votre dossier de stage est complet et approuve. Vous pouvez commencer votre stage.",
    type: "DOSSIER_STAGE_COMPLET",
    contractId: contract.id,
    actionUrl: `/contracts/${contract.id}`,
    userIds: [contract.studentId]
  });
}

async function markContractRejected(
  connection,
  contract,
  documensoStatus
) {
  await connection.execute(
    `
      UPDATE contrats
      SET
        statut = 'REJETE',
        documenso_status = ?,
        rejected_at = NOW()
      WHERE id = ?
    `,
    [documensoStatus, contract.id]
  );

  await connection.execute(
    `
      UPDATE dossiers_stage
      SET statut = 'DOCUMENT_INCOMPLET'
      WHERE id = ?
    `,
    [contract.folderId]
  );

  await createNotificationForUsers(connection, {
    title: "Contrat refuse ou annule",
    message:
      "Le contrat de stage a ete refuse ou annule dans Documenso.",
    type: "CONTRAT_REJETE",
    userIds: [contract.studentId]
  });
}

async function downloadAndSaveDocumensoPdf(
  contractId,
  documentId,
  type
) {
  const [rows] = await db.execute(
    `
      SELECT
        c.id,
        c.dossier_stage_id AS folderId,
        c.external_id AS externalId,
        ds.etudiant_id AS studentId
      FROM contrats c
      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id
      WHERE c.id = ?
      LIMIT 1
    `,
    [contractId]
  );

  const contract = rows[0];

  if (!contract) {
    return;
  }

  const signedPdfBuffer = await downloadSignedPdf(documentId);
  const pdf = await saveSignedContractPdf(
    contract,
    signedPdfBuffer
  );

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    if (type === "student") {
      await connection.execute(
        `
          UPDATE contrats
          SET pdf_etudiant_signe_path = ?
          WHERE id = ?
        `,
        [pdf.relativePath, contractId]
      );
    } else {
      await connection.execute(
        `
          UPDATE contrats
          SET
            chemin_fichier_televerse = ?,
            pdf_signed_path = ?,
            complete_le = COALESCE(complete_le, NOW()),
            completed_at = COALESCE(completed_at, NOW())
          WHERE id = ?
        `,
        [pdf.relativePath, pdf.relativePath, contractId]
      );
    }

    await saveDocumentRecord(connection, {
      folderId: contract.folderId,
      contractId,
      userId: contract.studentId,
      type:
        type === "student"
          ? "CONTRAT_SIGNE_ETUDIANT"
          : "CONTRAT_FINAL",
      fileName: pdf.fileName,
      filePath: pdf.relativePath,
      mimeType: "application/pdf",
      status: "VALIDE"
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function normalizeWebhookRecipients(recipients) {
  if (!Array.isArray(recipients)) {
    return [];
  }

  return recipients.map((recipient) => ({
    id: firstValue(
      recipient.id,
      recipient.recipientId
    ),
    email: recipient.email,
    signingOrder: firstValue(
      recipient.signingOrder,
      recipient.order
    ),
    signingStatus: firstValue(
      recipient.signingStatus,
      recipient.status
    ),
    readStatus: firstValue(
      recipient.readStatus,
      recipient.read_status
    ),
    sendStatus: recipient.sendStatus,
    signedAt: firstValue(
      recipient.signedAt,
      recipient.signed_at,
      recipient.completedAt
    )
  }));
}

export function mapDocumensoRecipientStatus(recipient) {
  const signingStatus = String(
    recipient.signingStatus || ""
  ).toUpperCase();

  const readStatus = String(
    recipient.readStatus || ""
  ).toUpperCase();

  const sendStatus = String(
    recipient.sendStatus || ""
  ).toUpperCase();

  if (
    signingStatus === "SIGNED" ||
    signingStatus === "COMPLETED"
  ) {
    return "SIGNE";
  }

  if (
    signingStatus === "REJECTED" ||
    signingStatus === "DECLINED"
  ) {
    return "REFUSE";
  }

  if (
    sendStatus === "SENT" ||
    sendStatus === "DELIVERED" ||
    readStatus === "OPENED" ||
    signingStatus === "OPENED"
  ) {
    return "ENVOYE";
  }

  return null;
}

function makeContractExternalId(contract) {
  return `stagetec-contract-${contract.id}-${Date.now()}`;
}

function normalizeDocumensoEventType(type) {
  const normalized = String(type || "")
    .trim()
    .toUpperCase()
    .replace(/[.\-\s]+/g, "_");

  const aliases = {
    RECIPIENT_COMPLETED:
      "DOCUMENT_RECIPIENT_COMPLETED",
    DOCUMENT_RECIPIENT_SIGNED:
      "DOCUMENT_RECIPIENT_COMPLETED",
    DOCUMENT_SIGNING_COMPLETE:
      "DOCUMENT_COMPLETED"
  };

  return aliases[normalized] || normalized;
}

function createEventHash(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function joinName(firstName, lastName) {
  return [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function fullStudentName(source) {
  return joinName(
    source.studentFirstName,
    source.studentLastName
  );
}

function sanitizeFileName(fileName) {
  const cleaned = path
    .basename(String(fileName || "contrat-signe.pdf"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);

  return cleaned || "contrat-signe.pdf";
}

function clean(value) {
  return String(value ?? "").trim();
}

function optional(value) {
  const cleanedValue = clean(value);

  return cleanedValue || null;
}

function toPositiveNumber(value, fieldName) {
  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    throw createError(
      `${fieldName} doit etre superieur a zero.`,
      400
    );
  }

  return numberValue;
}

function toNonNegativeNumber(value, fieldName) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    throw createError(
      `${fieldName} est obligatoire pour un stage remunere.`,
      400
    );
  }

  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    throw createError(
      `${fieldName} doit etre un nombre valide.`,
      400
    );
  }

  return numberValue;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "")
  );
}

function sameEmail(left, right) {
  return String(left || "").toLowerCase() ===
    String(right || "").toLowerCase();
}

function signerRoleLabel(role) {
  const labels = {
    ETUDIANT: "etudiant",
    ENTREPRISE: "milieu de stage",
    SUPERVISEUR: "enseignant",
    CONSEILLERE: "conseillere",
    DIRECTION: "direction"
  };

  return labels[role] || role || "signataire";
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}
