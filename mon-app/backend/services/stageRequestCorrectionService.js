import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDbPool } from "../config/db.js";
import { createNotificationForUsers } from "./notificationService.js";

const db = createDbPool();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const documentStorageRoot = path.join(
  backendRoot,
  "storage",
  "stage-request-documents"
);

export const CORRECTION_STATUSES = [
  "A_REVISER",
  "DOCUMENTS_MANQUANTS"
];

export const STUDENT_EDITABLE_REQUEST_STATUSES = [
  "SOUMISE",
  ...CORRECTION_STATUSES
];

export const REQUEST_DOCUMENT_TYPES = [
  "ATTESTATION",
  "CAQ",
  "PERMIS_ETUDES",
  "ASSURANCE",
  "PIECE_IDENTITE",
  "CV",
  "AUTRE"
];

export const MAX_REQUEST_DOCUMENT_SIZE_BYTES =
  10 * 1024 * 1024;

const ALLOWED_DOCUMENT_MIME_TYPES = new Map([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"]
]);

const TRACKED_REQUEST_FIELDS = [
  ["studentPhone", "telephone etudiant"],
  ["studentAddress", "adresse etudiant"],
  ["studentCity", "ville etudiant"],
  ["studentProvince", "province etudiant"],
  ["studentPostalCode", "code postal etudiant"],
  ["expirationCaq", "expiration CAQ"],
  ["expirationStudyPermit", "expiration permis d'etudes"],
  ["expirationInsurance", "expiration assurance"],
  ["taskSummary", "resume des taches"],
  ["startDate", "date de debut"],
  ["endDate", "date de fin"],
  ["companyName", "nom de l'entreprise"],
  ["companyNeq", "NEQ"],
  ["companyAddress", "adresse entreprise"],
  ["companyCity", "ville entreprise"],
  ["companyProvince", "province entreprise"],
  ["companyPostalCode", "code postal entreprise"],
  ["companyPhone", "telephone entreprise"],
  ["companyPhoneExtension", "poste entreprise"],
  ["companyEmail", "courriel entreprise"],
  ["companyWebsite", "site web entreprise"],
  ["organizationType", "type d'organisation"],
  ["businessSector", "secteur d'activite"],
  ["hrName", "responsable RH"],
  ["hrEmail", "courriel RH"],
  ["hrPhone", "telephone RH"],
  ["hrExtension", "poste RH"],
  ["supervisorName", "nom superviseur entreprise"],
  ["supervisorTitle", "titre superviseur entreprise"],
  ["supervisorEmail", "courriel superviseur entreprise"],
  ["supervisorPhone", "telephone superviseur entreprise"],
  ["workSchedule", "horaire"],
  ["hoursPerWeek", "heures par semaine"],
  ["workLanguage", "langue de travail"],
  ["scheduleType", "type d'horaire"],
  ["numberOfWeeks", "nombre de semaines"],
  ["isPaid", "stage remunere"],
  ["hourlySalary", "salaire horaire"],
  ["otherCompensation", "autre compensation"]
];

export async function requestStageRequestCorrections(
  supervisorId,
  requestId,
  data
) {
  const correction = normalizeCorrectionPayload(data);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const request = await findAssignedRequest(
      connection,
      supervisorId,
      requestId
    );

    if (
      !["SOUMISE", ...CORRECTION_STATUSES].includes(
        request.status
      )
    ) {
      throw createError(
        "Cette demande ne peut plus recevoir de demande de correction.",
        400
      );
    }

    await connection.execute(
      `
        UPDATE demandes_stage
        SET
          statut = ?,
          motif_refus = NULL,
          correction_raison = ?,
          correction_elements = ?,
          correction_documents_demandes = ?,
          correction_commentaire_etudiant = ?,
          correction_demandee_par_utilisateur_id = ?,
          correction_demandee_le = NOW(),
          decide_par_utilisateur_id = ?,
          decide_le = NOW()
        WHERE id = ?
      `,
      [
        correction.status,
        correction.reason,
        correction.correctionItems,
        JSON.stringify(correction.missingDocuments),
        correction.studentComment,
        supervisorId,
        supervisorId,
        requestId
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'DOCUMENT_INCOMPLET'
        WHERE id = ?
      `,
      [request.folderId]
    );

    await createWorkflowEvent(connection, {
      folderId: request.folderId,
      actorId: supervisorId,
      eventType:
        correction.status === "DOCUMENTS_MANQUANTS"
          ? "DOCUMENTS_MANQUANTS_DEMANDES"
          : "CORRECTIONS_DEMANDEES",
      oldStatus: request.status,
      newStatus: correction.status,
      comment: buildCorrectionEventComment(correction)
    });

    await createNotificationForUsers(connection, {
      title:
        correction.status === "DOCUMENTS_MANQUANTS"
          ? "Documents manquants"
          : "Corrections demandees",
      message: correction.studentComment,
      type:
        correction.status === "DOCUMENTS_MANQUANTS"
          ? "DEMANDE_STAGE_DOCUMENTS_MANQUANTS"
          : "DEMANDE_STAGE_A_REVISER",
      requestId,
      actionUrl: `/demandes-stage/${requestId}`,
      userIds: [request.studentId]
    });

    await connection.commit();

    return {
      id: Number(requestId),
      status: correction.status,
      correction,
      message:
        correction.status === "DOCUMENTS_MANQUANTS"
          ? "La demande de documents manquants a ete envoyee."
          : "La demande de corrections a ete envoyee."
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listStudentRequestDocuments(
  studentId,
  requestId
) {
  const request = await findStudentRequest(
    db,
    studentId,
    requestId
  );

  return getActiveRequestDocuments(
    db,
    request.id,
    request.folderId
  );
}

export async function addStudentRequestDocument(
  studentId,
  requestId,
  file
) {
  const normalizedFile =
    validateUploadedStageRequestDocument(file);
  const connection = await db.getConnection();
  let storedRelativePath = "";
  let storedAbsolutePath = "";

  try {
    await connection.beginTransaction();

    const request = await findStudentRequest(
      connection,
      studentId,
      requestId
    );

    ensureStudentCanModifyStatus(request.status);

    const [versionRows] = await connection.execute(
      `
        SELECT COALESCE(MAX(version_document), 0) + 1 AS nextVersion
        FROM documents
        WHERE demande_stage_id = ?
          AND type_document = ?
      `,
      [request.id, normalizedFile.documentType]
    );

    const version =
      Number(versionRows[0]?.nextVersion) || 1;
    const fileName = buildSafeStageDocumentName({
      requestId: request.id,
      documentType: normalizedFile.documentType,
      mimeType: normalizedFile.mimeType
    });

    storedRelativePath = path.posix.join(
      "stage-request-documents",
      String(request.folderId),
      String(request.id),
      fileName
    );
    storedAbsolutePath =
      resolvePrivateStageRequestDocumentPath(
        storedRelativePath
      );

    await fs.mkdir(path.dirname(storedAbsolutePath), {
      recursive: true
    });
    await fs.writeFile(
      storedAbsolutePath,
      normalizedFile.buffer
    );

    await connection.execute(
      `
        UPDATE documents
        SET statut = 'ARCHIVE'
        WHERE demande_stage_id = ?
          AND type_document = ?
          AND statut <> 'ARCHIVE'
      `,
      [request.id, normalizedFile.documentType]
    );

    const [result] = await connection.execute(
      `
        INSERT INTO documents (
          dossier_stage_id,
          demande_stage_id,
          depose_par_utilisateur_id,
          type_document,
          nom_fichier,
          chemin_fichier,
          type_mime,
          taille_octets,
          version_document,
          statut
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DEPOSE')
      `,
      [
        request.folderId,
        request.id,
        studentId,
        normalizedFile.documentType,
        normalizedFile.originalName,
        storedRelativePath,
        normalizedFile.mimeType,
        normalizedFile.size,
        version
      ]
    );

    await createWorkflowEvent(connection, {
      folderId: request.folderId,
      actorId: studentId,
      eventType:
        version > 1
          ? "DOCUMENT_STAGE_REMPLACE"
          : "DOCUMENT_STAGE_AJOUTE",
      oldStatus: request.status,
      newStatus: request.status,
      comment: JSON.stringify({
        documentType: normalizedFile.documentType,
        fileName: normalizedFile.originalName,
        version
      })
    });

    await connection.commit();

    return {
      id: result.insertId,
      requestId: request.id,
      type: normalizedFile.documentType,
      fileName: normalizedFile.originalName,
      mimeType: normalizedFile.mimeType,
      size: normalizedFile.size,
      version,
      status: "DEPOSE"
    };
  } catch (error) {
    await connection.rollback();

    if (storedAbsolutePath) {
      await fs.rm(storedAbsolutePath, {
        force: true
      });
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteStudentRequestDocument(
  studentId,
  requestId,
  documentId
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const request = await findStudentRequest(
      connection,
      studentId,
      requestId
    );

    ensureStudentCanModifyStatus(request.status);

    const document = await findRequestDocument(
      connection,
      {
        requestId: request.id,
        folderId: request.folderId,
        documentId
      }
    );

    await connection.execute(
      `
        UPDATE documents
        SET statut = 'ARCHIVE'
        WHERE id = ?
      `,
      [document.id]
    );

    await createWorkflowEvent(connection, {
      folderId: request.folderId,
      actorId: studentId,
      eventType: "DOCUMENT_STAGE_SUPPRIME",
      oldStatus: request.status,
      newStatus: request.status,
      comment: JSON.stringify({
        documentType: document.type,
        fileName: document.fileName,
        version: document.version
      })
    });

    await connection.commit();

    return {
      id: Number(documentId),
      status: "ARCHIVE"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getStudentRequestDocumentFile(
  studentId,
  requestId,
  documentId
) {
  const request = await findStudentRequest(
    db,
    studentId,
    requestId
  );
  const document = await findRequestDocument(db, {
    requestId: request.id,
    folderId: request.folderId,
    documentId
  });

  return resolveDocumentFile(document);
}

export async function getSupervisorRequestDocumentFile(
  supervisorId,
  requestId,
  documentId
) {
  const request = await findAssignedRequest(
    db,
    supervisorId,
    requestId
  );
  const document = await findRequestDocument(db, {
    requestId: request.id,
    folderId: request.folderId,
    documentId
  });

  return resolveDocumentFile(document);
}

export async function getActiveRequestDocuments(
  connection,
  requestId,
  folderId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        demande_stage_id AS requestId,
        type_document AS type,
        nom_fichier AS fileName,
        type_mime AS mimeType,
        taille_octets AS size,
        version_document AS version,
        statut AS status,
        cree_le AS uploadedAt
      FROM documents
      WHERE demande_stage_id = ?
        AND dossier_stage_id = ?
        AND statut <> 'ARCHIVE'
      ORDER BY cree_le DESC, id DESC
    `,
    [requestId, folderId]
  );

  return rows.map(formatDocument);
}

export async function getRequestWorkflowHistory(
  connection,
  folderId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        e.id,
        e.type_evenement AS type,
        e.ancien_statut AS oldStatus,
        e.nouveau_statut AS newStatus,
        e.commentaire AS comment,
        e.cree_le AS createdAt,
        u.prenom AS actorFirstName,
        u.nom AS actorLastName,
        u.role AS actorRole
      FROM evenements_workflow e
      LEFT JOIN utilisateurs u
        ON u.id = e.utilisateur_acteur_id
      WHERE e.dossier_stage_id = ?
      ORDER BY e.cree_le DESC, e.id DESC
      LIMIT 20
    `,
    [folderId]
  );

  return rows.map((row) => ({
    ...row,
    actorName: [row.actorFirstName, row.actorLastName]
      .filter(Boolean)
      .join(" ")
      .trim()
  }));
}

export async function ensureRequestedDocumentsPresent(
  connection,
  request
) {
  const requestedDocuments = parseDocumentList(
    request.correctionMissingDocuments
  );

  if (!requestedDocuments.length) {
    return [];
  }

  const [rows] = await connection.execute(
    `
      SELECT DISTINCT type_document AS type
      FROM documents
      WHERE demande_stage_id = ?
        AND dossier_stage_id = ?
        AND statut <> 'ARCHIVE'
    `,
    [request.id, request.folderId]
  );

  const presentTypes = new Set(
    rows.map((row) => row.type)
  );
  const missingTypes = requestedDocuments.filter(
    (type) => !presentTypes.has(type)
  );

  if (missingTypes.length) {
    throw createError(
      `Documents manquants : ${missingTypes.join(", ")}.`,
      400
    );
  }

  return requestedDocuments;
}

export function normalizeCorrectionPayload(data = {}) {
  const status = clean(data.status);
  const reason = clean(data.reason);
  const correctionItems = clean(
    data.correctionItems
  );
  const studentComment = clean(
    data.studentComment
  );
  const missingDocuments = normalizeDocumentTypeList(
    data.missingDocuments
  );

  if (!CORRECTION_STATUSES.includes(status)) {
    throw createError(
      "Type de correction invalide.",
      400
    );
  }

  if (reason.length < 10) {
    throw createError(
      "La raison doit contenir au moins 10 caracteres.",
      400
    );
  }

  if (correctionItems.length < 3) {
    throw createError(
      "Les elements a corriger sont obligatoires.",
      400
    );
  }

  if (studentComment.length < 10) {
    throw createError(
      "Le commentaire destine a l'etudiant doit contenir au moins 10 caracteres.",
      400
    );
  }

  if (
    status === "DOCUMENTS_MANQUANTS" &&
    !missingDocuments.length
  ) {
    throw createError(
      "Indiquez au moins un document manquant.",
      400
    );
  }

  return {
    status,
    reason,
    correctionItems,
    missingDocuments,
    studentComment
  };
}

export function ensureStudentCanModifyStatus(status) {
  if (!STUDENT_EDITABLE_REQUEST_STATUSES.includes(status)) {
    throw createError(
      status === "REFUSEE"
        ? "Cette demande est refusee definitivement et ne peut plus etre modifiee."
        : "Cette demande ne peut plus etre modifiee.",
      403
    );
  }
}

export function ensureStudentOwnsRequest(row) {
  if (!row) {
    throw createError(
      "Demande de stage introuvable.",
      404
    );
  }

  return row;
}

export function assertSameRequestOnResubmission(
  originalRequestId,
  resubmittedRequestId
) {
  if (
    Number(originalRequestId) !==
    Number(resubmittedRequestId)
  ) {
    throw createError(
      "La resoumission doit conserver le meme identifiant de demande.",
      500
    );
  }

  return true;
}

export function shouldDisplayResubmittedBadge(request) {
  return Boolean(
    request?.status === "SOUMISE" &&
      request?.resubmittedAt
  );
}

export function isRequestInSupervisorReviewFilter(
  request
) {
  return request?.status === "SOUMISE";
}

export function validateUploadedStageRequestDocument(
  file = {}
) {
  const documentType = clean(file.documentType);
  const originalName = sanitizeOriginalFileName(
    file.originalName || file.fileName
  );
  const mimeType = clean(file.mimeType);
  const buffer = file.buffer;
  const size = Number(file.size ?? buffer?.length);

  if (!REQUEST_DOCUMENT_TYPES.includes(documentType)) {
    throw createError(
      "Type de document invalide.",
      400
    );
  }

  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)) {
    throw createError(
      "Type de fichier non autorise. Utilisez PDF, JPG ou PNG.",
      400
    );
  }

  if (
    !Buffer.isBuffer(buffer) ||
    !Number.isFinite(size) ||
    size <= 0
  ) {
    throw createError(
      "Le fichier est obligatoire.",
      400
    );
  }

  if (size > MAX_REQUEST_DOCUMENT_SIZE_BYTES) {
    throw createError(
      "Le fichier depasse la taille maximale de 10 Mo.",
      400
    );
  }

  return {
    documentType,
    originalName,
    mimeType,
    size,
    buffer
  };
}

export function buildSafeStageDocumentName({
  requestId,
  documentType,
  mimeType
}) {
  const extension =
    ALLOWED_DOCUMENT_MIME_TYPES.get(mimeType);

  if (!extension) {
    throw createError(
      "Type de fichier non autorise.",
      400
    );
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const randomPart = crypto
    .randomBytes(6)
    .toString("hex");

  return `demande-${Number(requestId)}-${documentType.toLowerCase()}-${timestamp}-${randomPart}.${extension}`;
}

export function resolvePrivateStageRequestDocumentPath(
  relativePath
) {
  const normalizedRelativePath = String(relativePath)
    .split("\\")
    .join("/");

  if (
    !normalizedRelativePath.startsWith(
      "stage-request-documents/"
    )
  ) {
    throw createError(
      "Chemin de document invalide.",
      400
    );
  }

  const suffix = normalizedRelativePath.replace(
    "stage-request-documents/",
    ""
  );
  const absolutePath = path.resolve(
    documentStorageRoot,
    suffix
  );
  const relativeFromRoot = path.relative(
    documentStorageRoot,
    absolutePath
  );

  if (
    relativeFromRoot.startsWith("..") ||
    path.isAbsolute(relativeFromRoot)
  ) {
    throw createError(
      "Chemin de document invalide.",
      400
    );
  }

  return absolutePath;
}

export function compareRequestChanges(
  previous,
  next
) {
  return TRACKED_REQUEST_FIELDS.filter(([key]) => {
    const previousValue = normalizeComparableValue(
      previous?.[key]
    );
    const nextValue = normalizeComparableValue(
      next?.[key]
    );

    return previousValue !== nextValue;
  }).map(([key, label]) => ({
    field: key,
    label,
    previousValue: previous?.[key] ?? null,
    nextValue: next?.[key] ?? null
  }));
}

export function parseDocumentList(value) {
  if (Array.isArray(value)) {
    return normalizeDocumentTypeList(value);
  }

  if (!value) {
    return [];
  }

  try {
    return normalizeDocumentTypeList(JSON.parse(value));
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter((item) =>
        REQUEST_DOCUMENT_TYPES.includes(item)
      );
  }
}

export async function createResubmissionWorkflowEvent(
  connection,
  {
    folderId,
    actorId,
    oldStatus,
    changedFields,
    uploadedDocuments
  }
) {
  await createWorkflowEvent(connection, {
    folderId,
    actorId,
    eventType: "DEMANDE_RESOUMISE",
    oldStatus,
    newStatus: "SOUMISE",
    comment: JSON.stringify({
      changedFields: changedFields.map(
        (change) => change.label
      ),
      uploadedDocuments
    })
  });
}

export async function notifySupervisorOfResubmission(
  connection,
  {
    supervisorId,
    studentFullName,
    requestId,
    changedFields,
    uploadedDocuments
  }
) {
  if (!supervisorId) {
    return null;
  }

  const changedText = changedFields.length
    ? ` Champs modifies : ${changedFields
        .map((field) => field.label)
        .join(", ")}.`
    : "";
  const documentsText = uploadedDocuments.length
    ? ` Documents ajoutes ou remplaces : ${uploadedDocuments.join(", ")}.`
    : "";

  return createNotificationForUsers(connection, {
    title: "Demande de stage resoumise",
    message: `La demande de stage de ${studentFullName || "l'etudiant"} (#${requestId}) a ete corrigee et resoumise.${changedText}${documentsText}`,
    type: "DEMANDE_STAGE_RESOUMISE",
    requestId,
    actionUrl: `/supervisor/stages/requests/${requestId}`,
    userIds: [supervisorId]
  });
}

export async function listActiveUploadedDocumentTypes(
  connection,
  requestId,
  folderId
) {
  const [rows] = await connection.execute(
    `
      SELECT DISTINCT type_document AS type
      FROM documents
      WHERE demande_stage_id = ?
        AND dossier_stage_id = ?
        AND statut <> 'ARCHIVE'
      ORDER BY type_document ASC
    `,
    [requestId, folderId]
  );

  return rows.map((row) => row.type);
}

async function findAssignedRequest(
  connection,
  supervisorId,
  requestId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        d.id,
        d.dossier_stage_id AS folderId,
        d.statut AS status,
        ds.etudiant_id AS studentId
      FROM demandes_stage d
      INNER JOIN dossiers_stage ds
        ON ds.id = d.dossier_stage_id
      WHERE d.id = ?
        AND ds.superviseur_id = ?
      LIMIT 1
    `,
    [requestId, supervisorId]
  );

  if (!rows[0]) {
    throw createError(
      "Demande introuvable ou non assignee a ce superviseur.",
      404
    );
  }

  return rows[0];
}

async function findStudentRequest(
  connection,
  studentId,
  requestId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        d.id,
        d.dossier_stage_id AS folderId,
        d.statut AS status,
        d.correction_documents_demandes AS correctionMissingDocuments,
        ds.superviseur_id AS supervisorId
      FROM demandes_stage d
      INNER JOIN dossiers_stage ds
        ON ds.id = d.dossier_stage_id
      WHERE d.id = ?
        AND ds.etudiant_id = ?
      LIMIT 1
    `,
    [requestId, studentId]
  );

  return ensureStudentOwnsRequest(rows[0]);
}

async function findRequestDocument(
  connection,
  {
    requestId,
    folderId,
    documentId
  }
) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
        demande_stage_id AS requestId,
        dossier_stage_id AS folderId,
        type_document AS type,
        nom_fichier AS fileName,
        chemin_fichier AS filePath,
        type_mime AS mimeType,
        taille_octets AS size,
        version_document AS version,
        statut AS status,
        cree_le AS uploadedAt
      FROM documents
      WHERE id = ?
        AND demande_stage_id = ?
        AND dossier_stage_id = ?
        AND statut <> 'ARCHIVE'
      LIMIT 1
    `,
    [documentId, requestId, folderId]
  );

  if (!rows[0]) {
    throw createError("Document introuvable.", 404);
  }

  return formatDocument(rows[0]);
}

async function resolveDocumentFile(document) {
  const absolutePath =
    resolvePrivateStageRequestDocumentPath(
      document.filePath
    );

  await fs.access(absolutePath);

  return {
    absolutePath,
    fileName: document.fileName,
    mimeType: document.mimeType
  };
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

function buildCorrectionEventComment(correction) {
  return JSON.stringify({
    reason: correction.reason,
    correctionItems: correction.correctionItems,
    missingDocuments: correction.missingDocuments,
    studentComment: correction.studentComment
  });
}

function normalizeDocumentTypeList(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim());

  return [
    ...new Set(
      values
        .map((item) => clean(item).toUpperCase())
        .filter((item) =>
          REQUEST_DOCUMENT_TYPES.includes(item)
        )
    )
  ];
}

function sanitizeOriginalFileName(fileName) {
  const cleaned = path
    .basename(String(fileName || "document"))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  return cleaned || "document";
}

function formatDocument(row) {
  return {
    ...row,
    size:
      row.size === null || row.size === undefined
        ? null
        : Number(row.size),
    version: Number(row.version)
  };
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return String(value).trim();
}

function clean(value) {
  return String(value ?? "").trim();
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
