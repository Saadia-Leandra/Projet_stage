import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDbPool } from "../config/db.js";
import { createNotificationForUsers } from "./notificationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = createDbPool();

export const documentsStorageRoot = path.resolve(
  __dirname,
  "..",
  "storage",
  "documents"
);

export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  "CV",
  "ATTESTATION",
  "ASSURANCE",
  "CAQ",
  "PERMIS_ETUDES",
  "AUTRE"
]);

const ALLOWED_MIME_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"]
]);

const TRANSVERSAL_ROLES = new Set(["CONSEILLERE"]);
const MODERATOR_ROLES = new Set(["CONSEILLERE"]);

async function assertStageFileAccess(stageFileId, user) {
  const [rows] = await db.execute(
    `
      SELECT id, etudiant_id, superviseur_id
      FROM dossiers_stage
      WHERE id = ?
      LIMIT 1
    `,
    [stageFileId]
  );

  if (!rows[0]) {
    throw createError("Dossier de stage introuvable.", 404);
  }

  const stageFile = rows[0];
  const allowed =
    TRANSVERSAL_ROLES.has(user.role) ||
    (user.role === "ETUDIANT" && stageFile.etudiant_id === user.id);

  if (!allowed) {
    throw createError("Acces refuse a ce dossier de stage.", 403);
  }

  return stageFile;
}

async function loadDocumentWithAccess(documentId, user) {
  const [rows] = await db.execute(
    `
      SELECT
        doc.id,
        doc.dossier_stage_id AS stageFileId,
        doc.depose_par_utilisateur_id AS uploaderId,
        doc.type_document AS type,
        doc.nom_fichier AS fileName,
        doc.chemin_fichier AS storagePath,
        doc.type_mime AS mimeType,
        doc.taille_octets AS sizeBytes,
        doc.version_document AS version,
        doc.statut AS status
      FROM documents doc
      WHERE doc.id = ?
      LIMIT 1
    `,
    [documentId]
  );

  if (!rows[0] || rows[0].status === "ARCHIVE") {
    throw createError("Document introuvable.", 404);
  }

  await assertStageFileAccess(rows[0].stageFileId, user);

  return rows[0];
}

async function logAction(connection, { documentId, userId, action, details }) {
  await connection.execute(
    `
      INSERT INTO historique_document (document_id, utilisateur_id, action, details)
      VALUES (?, ?, ?, ?)
    `,
    [documentId, userId, action, details ? JSON.stringify(details) : null]
  );
}

const CHECKLIST_TYPES = [
  { type: "CV", label: "CV" },
  { type: "ATTESTATION", label: "Attestation de stage" },
  { type: "ASSURANCE", label: "Assurance" },
  { type: "CAQ", label: "CAQ" },
  { type: "PERMIS_ETUDES", label: "Permis d'etudes" }
];
const CHECKLIST_TYPE_SET = new Set(CHECKLIST_TYPES.map((c) => c.type));

export async function getChecklist({ user, stageFileId }) {
  await assertStageFileAccess(stageFileId, user);

  const [rows] = await db.query(
    `SELECT type_document AS type, est_a_jour AS done, modifie_le AS updatedAt
       FROM checklist_document WHERE dossier_stage_id = ?`,
    [stageFileId]
  );
  const byType = new Map(rows.map((r) => [r.type, r]));

  return CHECKLIST_TYPES.map((item) => {
    const existing = byType.get(item.type);
    return {
      type: item.type,
      label: item.label,
      done: existing ? Boolean(existing.done) : false,
      updatedAt: existing ? existing.updatedAt : null
    };
  });
}

export async function setChecklistItem({ user, stageFileId, type, done }) {
  await assertStageFileAccess(stageFileId, user);

  if (!CHECKLIST_TYPE_SET.has(type)) {
    throw createError("Type de document invalide pour la checklist.", 400);
  }

  await db.execute(
    `
      INSERT INTO checklist_document (dossier_stage_id, type_document, est_a_jour, coche_par_utilisateur_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE est_a_jour = VALUES(est_a_jour),
                              coche_par_utilisateur_id = VALUES(coche_par_utilisateur_id)
    `,
    [stageFileId, type, done ? 1 : 0, user.id]
  );

  return { type, done: Boolean(done) };
}

export async function listAccessibleStageFiles(user) {
  const where = [];
  const params = [];

  if (user.role === "ETUDIANT") {
    where.push("ds.etudiant_id = ?");
    params.push(user.id);
  } else if (!TRANSVERSAL_ROLES.has(user.role)) {
    return [];
  }

  const [rows] = await db.execute(
    `
      SELECT
        ds.id AS stageFileId,
        ds.statut AS status,
        etu.code_etudiant AS studentCode,
        CONCAT(u.prenom, ' ', u.nom) AS studentName
      FROM dossiers_stage ds
      JOIN etudiants etu ON etu.utilisateur_id = ds.etudiant_id
      JOIN utilisateurs u ON u.id = ds.etudiant_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY studentName ASC
    `,
    params
  );

  return rows;
}

export async function listDocuments({ user, stageFileId, type }) {
  await assertStageFileAccess(stageFileId, user);

  const params = [stageFileId];
  let typeFilter = "";

  if (type) {
    params.push(type);
    typeFilter = " AND doc.type_document = ?";
  }

  const [rows] = await db.execute(
    `
      SELECT
        doc.id,
        doc.type_document AS type,
        doc.nom_fichier AS fileName,
        doc.type_mime AS mimeType,
        doc.taille_octets AS sizeBytes,
        doc.version_document AS version,
        doc.code_confirmation AS confirmationCode,
        doc.cree_le AS createdAt,
        CONCAT(u.prenom, ' ', u.nom) AS uploaderName
      FROM documents doc
      JOIN utilisateurs u ON u.id = doc.depose_par_utilisateur_id
      WHERE doc.dossier_stage_id = ?
        AND doc.statut <> 'ARCHIVE'
        ${typeFilter}
      ORDER BY doc.cree_le DESC
    `,
    params
  );

  return rows;
}

export async function getDocument({ user, documentId }) {
  const document = await loadDocumentWithAccess(documentId, user);

  const [[uploader]] = await db.execute(
    `SELECT CONCAT(prenom, ' ', nom) AS uploaderName FROM utilisateurs WHERE id = ?`,
    [document.uploaderId]
  );

  return { ...document, uploaderName: uploader?.uploaderName || null };
}

export async function createDocument({ user, stageFileId, type, file }) {
  await assertStageFileAccess(stageFileId, user);

  const documentType = ALLOWED_DOCUMENT_TYPES.has(type) ? type : "AUTRE";
  const { storagePath, sizeBytes } = await persistFile(stageFileId, file);
  const confirmationCode = crypto.randomBytes(4).toString("hex").toUpperCase();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `
        INSERT INTO documents (
          dossier_stage_id,
          depose_par_utilisateur_id,
          type_document,
          nom_fichier,
          chemin_fichier,
          type_mime,
          taille_octets,
          code_confirmation,
          version_document,
          statut
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'DEPOSE')
      `,
      [
        stageFileId,
        user.id,
        documentType,
        sanitizeFileName(file.fileName),
        storagePath,
        file.contentType,
        sizeBytes,
        confirmationCode
      ]
    );

    await logAction(connection, {
      documentId: result.insertId,
      userId: user.id,
      action: "DEPOT",
      details: { fileName: file.fileName, sizeBytes }
    });

    await connection.commit();

    return {
      id: result.insertId,
      type: documentType,
      fileName: sanitizeFileName(file.fileName),
      sizeBytes,
      version: 1,
      confirmationCode,
      status: "DEPOSE"
    };
  } catch (error) {
    await connection.rollback();
    await safeUnlink(storagePath);
    throw error;
  } finally {
    connection.release();
  }
}

export async function addDocumentVersion({ user, documentId, file }) {
  const document = await loadDocumentWithAccess(documentId, user);
  const { storagePath, sizeBytes } = await persistFile(document.stageFileId, file);
  const nextVersion = document.version + 1;

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE documents
        SET nom_fichier = ?, chemin_fichier = ?, type_mime = ?,
            taille_octets = ?, version_document = ?, statut = 'DEPOSE'
        WHERE id = ?
      `,
      [
        sanitizeFileName(file.fileName),
        storagePath,
        file.contentType,
        sizeBytes,
        nextVersion,
        documentId
      ]
    );

    await logAction(connection, {
      documentId,
      userId: user.id,
      action: "NOUVELLE_VERSION",
      details: { version: nextVersion, fileName: file.fileName }
    });

    await connection.commit();

    return { id: documentId, version: nextVersion, sizeBytes };
  } catch (error) {
    await connection.rollback();
    await safeUnlink(storagePath);
    throw error;
  } finally {
    connection.release();
  }
}

export async function prepareDocumentDownload({ user, documentId }) {
  const document = await loadDocumentWithAccess(documentId, user);
  const absolutePath = resolveStorageAbsolutePath(document.storagePath);

  try {
    await fs.access(absolutePath);
  } catch {
    throw createError("Fichier absent du stockage.", 410);
  }

  await logAction(db, {
    documentId,
    userId: user.id,
    action: "TELECHARGEMENT",
    details: { version: document.version }
  });

  return {
    absolutePath,
    fileName: document.fileName,
    mimeType: document.mimeType || "application/octet-stream"
  };
}

export async function archiveDocument({ user, documentId }) {
  const document = await loadDocumentWithAccess(documentId, user);

  const allowed =
    document.uploaderId === user.id || MODERATOR_ROLES.has(user.role);

  if (!allowed) {
    throw createError(
      "Seul le deposant ou l'administration peut supprimer ce document.",
      403
    );
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE documents SET statut = 'ARCHIVE' WHERE id = ?`,
      [documentId]
    );

    await logAction(connection, {
      documentId,
      userId: user.id,
      action: "ARCHIVAGE"
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listDocumentHistory({ user, documentId }) {
  await loadDocumentWithAccess(documentId, user);

  const [rows] = await db.execute(
    `
      SELECT
        h.id,
        h.action,
        h.details,
        h.cree_le AS createdAt,
        u.id AS userId,
        CONCAT(u.prenom, ' ', u.nom) AS userName,
        u.role AS userRole
      FROM historique_document h
      JOIN utilisateurs u ON u.id = h.utilisateur_id
      WHERE h.document_id = ?
      ORDER BY h.cree_le DESC, h.id DESC
    `,
    [documentId]
  );

  return rows;
}

export async function listDossierComments({ user, stageFileId }) {
  await assertStageFileAccess(stageFileId, user);

  const [rows] = await db.query(
    `
      SELECT c.id, c.parent_id AS parentId, c.contenu AS content,
             c.cree_le AS createdAt, c.modifie_le AS updatedAt,
             (c.supprime_le IS NOT NULL) AS deleted,
             u.id AS authorId, CONCAT(u.prenom, ' ', u.nom) AS authorName, u.role AS authorRole
        FROM commentaires_dossier c
        JOIN utilisateurs u ON u.id = c.auteur_utilisateur_id
       WHERE c.dossier_stage_id = ?
       ORDER BY c.cree_le ASC, c.id ASC
    `,
    [stageFileId]
  );

  const byId = new Map(
    rows.map((r) => [r.id, { ...r, deleted: Boolean(r.deleted), replies: [] }])
  );
  const roots = [];
  for (const comment of byId.values()) {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  }

  function prune(list) {
    return list.filter((comment) => {
      comment.replies = prune(comment.replies);
      if (comment.deleted) {
        if (comment.replies.length === 0) {
          return false;
        }
        comment.content = "Commentaire supprimé";
        comment.authorName = "";
        comment.authorRole = "";
      }
      return true;
    });
  }
  return prune(roots);
}

export async function addDossierComment({ user, stageFileId, content, parentId }) {
  await assertStageFileAccess(stageFileId, user);

  const cleanContent = String(content ?? "").trim();
  if (!cleanContent) {
    throw createError("Le contenu du commentaire est requis.", 400);
  }
  if (cleanContent.length > 5000) {
    throw createError("Le commentaire ne peut depasser 5000 caracteres.", 400);
  }

  let effectiveParentId = parentId || null;
  if (parentId) {
    const [rows] = await db.query(
      `SELECT parent_id FROM commentaires_dossier
        WHERE id = ? AND dossier_stage_id = ? AND supprime_le IS NULL LIMIT 1`,
      [parentId, stageFileId]
    );
    if (!rows[0]) {
      throw createError("Commentaire parent introuvable.", 404);
    }
    effectiveParentId = rows[0].parent_id || parentId;
  }

  const [result] = await db.execute(
    `INSERT INTO commentaires_dossier (dossier_stage_id, auteur_utilisateur_id, parent_id, contenu)
     VALUES (?, ?, ?, ?)`,
    [stageFileId, user.id, effectiveParentId, cleanContent]
  );

  try {
    const [[dossier]] = await db.query(
      "SELECT etudiant_id, superviseur_id FROM dossiers_stage WHERE id = ? LIMIT 1",
      [stageFileId]
    );
    const recipientIds = new Set();
    if (dossier?.etudiant_id) recipientIds.add(Number(dossier.etudiant_id));
    const [cons] = await db.query(
      "SELECT id FROM utilisateurs WHERE role = 'CONSEILLERE' AND statut = 'ACTIF'"
    );
    cons.forEach((r) => recipientIds.add(Number(r.id)));
    recipientIds.delete(Number(user.id));

    const notificationText = `${user.fullName || "Un acteur"} a commente dans la discussion generale.`;
    const toNotify = [];
    for (const id of recipientIds) {
      const [[row]] = await db.query(
        `SELECT COUNT(*) AS n
           FROM destinataires_notification dn
           JOIN notifications n2 ON n2.id = dn.notification_id
          WHERE dn.utilisateur_destinataire_id = ? AND dn.lu_le IS NULL AND n2.message = ?`,
        [id, notificationText]
      );
      if (!Number(row.n)) toNotify.push(id);
    }

    if (toNotify.length) {
      await createNotificationForUsers(db, {
        title: "Nouveau commentaire",
        message: notificationText,
        type: "COMMENTAIRE_DOSSIER",
        userIds: toNotify,
        actionUrl: "/documents"
      });
    }
  } catch (notifError) {
    console.error("Notification de discussion non envoyee:", notifError.message);
  }

  return { id: result.insertId, content: cleanContent, parentId: effectiveParentId };
}

export async function updateDossierComment({ user, commentId, content }) {
  const cleanContent = String(content ?? "").trim();
  if (!cleanContent) {
    throw createError("Le contenu du commentaire est requis.", 400);
  }

  const [rows] = await db.query(
    "SELECT auteur_utilisateur_id FROM commentaires_dossier WHERE id = ? AND supprime_le IS NULL LIMIT 1",
    [commentId]
  );
  if (!rows[0]) {
    throw createError("Commentaire introuvable.", 404);
  }
  if (rows[0].auteur_utilisateur_id !== user.id) {
    throw createError("Vous ne pouvez modifier que vos propres commentaires.", 403);
  }

  await db.execute(
    "UPDATE commentaires_dossier SET contenu = ? WHERE id = ?",
    [cleanContent, commentId]
  );
  return { id: commentId, content: cleanContent };
}

export async function deleteDossierComment({ user, commentId }) {
  const [rows] = await db.query(
    "SELECT auteur_utilisateur_id FROM commentaires_dossier WHERE id = ? AND supprime_le IS NULL LIMIT 1",
    [commentId]
  );
  if (!rows[0]) {
    throw createError("Commentaire introuvable.", 404);
  }
  const allowed =
    rows[0].auteur_utilisateur_id === user.id || MODERATOR_ROLES.has(user.role);
  if (!allowed) {
    throw createError("Suppression non autorisee.", 403);
  }

  await db.execute(
    "UPDATE commentaires_dossier SET supprime_le = NOW() WHERE id = ?",
    [commentId]
  );
}

async function persistFile(stageFileId, file) {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw createError("Aucun fichier fourni.", 400);
  }

  if (file.buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    throw createError("Le fichier depasse la taille maximale de 10 Mo.", 413);
  }

  const extension = ALLOWED_MIME_TYPES.get(file.contentType);

  if (!extension) {
    throw createError(
      "Format non autorise. Formats acceptes : PDF, DOC, DOCX, JPG, PNG.",
      400
    );
  }

  const fileName = `${crypto.randomUUID()}${extension}`;
  const relativePath = normalizeStoragePath(path.join(String(stageFileId), fileName));
  const absolutePath = resolveStorageAbsolutePath(relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return { storagePath: relativePath, sizeBytes: file.buffer.length };
}

function resolveStorageAbsolutePath(relativePath) {
  const absolutePath = path.resolve(documentsStorageRoot, relativePath);

  if (
    absolutePath !== documentsStorageRoot &&
    !absolutePath.startsWith(documentsStorageRoot + path.sep)
  ) {
    throw createError("Chemin de fichier invalide.", 400);
  }

  return absolutePath;
}

async function safeUnlink(relativePath) {
  try {
    await fs.unlink(resolveStorageAbsolutePath(relativePath));
  } catch {
    return;
  }
}

function normalizeStoragePath(value) {
  return value.split(path.sep).join("/");
}

function sanitizeFileName(value) {
  const base = path.basename(String(value ?? "document")).trim();
  return base.slice(0, 180) || "document";
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
