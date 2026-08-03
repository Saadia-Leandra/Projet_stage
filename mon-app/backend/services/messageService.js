import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDbPool } from "../config/db.js";
import { createNotificationForUsers } from "./notificationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = createDbPool();

export const messagesStorageRoot = path.resolve(__dirname, "..", "storage", "messages");

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Map([
  ["application/pdf", ".pdf"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"]
]);

let messageSchemaCache = null;

async function getMessageSchemaColumns() {
  if (messageSchemaCache) {
    return messageSchemaCache;
  }

  const [rows] = await db.query("DESCRIBE messages");
  messageSchemaCache = new Set(rows.map((row) => row.Field));
  return messageSchemaCache;
}

async function hasModernMessageSchema() {
  const columns = await getMessageSchemaColumns();
  return columns.has("destinataire_id") && columns.has("lu_le") && columns.has("cree_le");
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function hasUnreadNotification(userId, message) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS n
       FROM destinataires_notification dn
       JOIN notifications n2 ON n2.id = dn.notification_id
      WHERE dn.utilisateur_destinataire_id = ? AND dn.lu_le IS NULL AND n2.message = ?`,
    [userId, message]
  );
  return Number(row.n) > 0;
}

async function persistAttachment(file) {
  if (file.buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw createError("Le fichier depasse la taille maximale de 10 Mo.", 413);
  }

  const extension = ALLOWED_MIME_TYPES.get(file.contentType);
  if (!extension) {
    throw createError("Format non autorise. Formats acceptes : PDF, DOC, DOCX, JPG, PNG.", 400);
  }

  const storedName = `${crypto.randomUUID()}${extension}`;
  const absolutePath = path.resolve(messagesStorageRoot, storedName);

  await fs.mkdir(messagesStorageRoot, { recursive: true });
  await fs.writeFile(absolutePath, file.buffer);

  return {
    fileName: path.basename(String(file.fileName ?? "fichier")).slice(0, 255) || "fichier",
    storedPath: storedName,
    mimeType: file.contentType,
    sizeBytes: file.buffer.length
  };
}

export async function calculateContactIds(user, database) {
  const ids = new Set();

  if (user.role === "ETUDIANT") {
    const [sup] = await database.query(
      `SELECT DISTINCT superviseur_id AS id FROM dossiers_stage
        WHERE etudiant_id = ? AND superviseur_id IS NOT NULL`,
      [user.id]
    );
    sup.forEach((r) => ids.add(Number(r.id)));

    const [cons] = await database.query(
      `SELECT id FROM utilisateurs WHERE role = 'CONSEILLERE' AND statut = 'ACTIF'`
    );
    cons.forEach((r) => ids.add(Number(r.id)));
  } else if (user.role === "SUPERVISEUR") {
    const [etu] = await database.query(
      `SELECT DISTINCT etudiant_id AS id FROM dossiers_stage
        WHERE superviseur_id = ?`,
      [user.id]
    );
    etu.forEach((r) => ids.add(Number(r.id)));

    const [cons] = await database.query(
      `SELECT id FROM utilisateurs WHERE role = 'CONSEILLERE' AND statut = 'ACTIF'`
    );
    cons.forEach((r) => ids.add(Number(r.id)));
  } else if (user.role === "CONSEILLERE") {
    const [rows] = await database.query(
      `SELECT id FROM utilisateurs
        WHERE role IN ('ETUDIANT', 'SUPERVISEUR', 'DIRECTION', 'COMPTABILITE')
          AND statut = 'ACTIF'`
    );
    rows.forEach((r) => ids.add(Number(r.id)));
  } else if (user.role === "COMPTABILITE") {
    const [rows] = await database.query(
      `SELECT id FROM utilisateurs
        WHERE role IN ('DIRECTION', 'CONSEILLERE') AND statut = 'ACTIF'`
    );
    rows.forEach((r) => ids.add(Number(r.id)));
  } else if (user.role === "DIRECTION") {
    const [rows] = await database.query(
      `SELECT id FROM utilisateurs
        WHERE role IN ('CONSEILLERE', 'COMPTABILITE') AND statut = 'ACTIF'`
    );
    rows.forEach((r) => ids.add(Number(r.id)));
  }

  ids.delete(Number(user.id));
  return ids;
}

async function getContactIds(user) {
  return calculateContactIds(user, db);
}

async function assertContact(user, otherUserId) {
  const contacts = await getContactIds(user);
  if (!contacts.has(Number(otherUserId))) {
    throw createError("Cette personne n'est pas dans vos contacts.", 403);
  }
}

export function assertAllowedMessageRecipient(user, recipientId, contactIds) {
  if (contactIds.has(Number(recipientId))) return;

  if (user.role === "DIRECTION") {
    throw createError(
      "La Direction peut envoyer des messages uniquement a la conseillere ou a la comptabilite actives.",
      403
    );
  }

  throw createError("Cette personne n'est pas dans vos contacts.", 403);
}

export async function listContacts(user) {
  const contactIds = [...(await getContactIds(user))];
  if (contactIds.length === 0) {
    return [];
  }

  if (!(await hasModernMessageSchema())) {
    const placeholders = contactIds.map(() => "?").join(", ");
    const [rows] = await db.query(
      `
        SELECT u.id, CONCAT(u.prenom, ' ', u.nom) AS name, u.role
          FROM utilisateurs u
         WHERE u.id IN (${placeholders})
         ORDER BY name ASC
      `,
      contactIds
    );

    return rows.map((row) => ({
      ...row,
      lastMessage: null,
      lastAt: null,
      unread: 0
    }));
  }

  const placeholders = contactIds.map(() => "?").join(", ");

  const [rows] = await db.query(
    `
      SELECT
        u.id,
        CONCAT(u.prenom, ' ', u.nom) AS name,
        u.role,
        (
          SELECT m.contenu FROM messages m
           WHERE (m.expediteur_id = u.id AND m.destinataire_id = ?)
              OR (m.expediteur_id = ? AND m.destinataire_id = u.id)
           ORDER BY m.cree_le DESC LIMIT 1
        ) AS lastMessage,
        (
          SELECT m.cree_le FROM messages m
           WHERE (m.expediteur_id = u.id AND m.destinataire_id = ?)
              OR (m.expediteur_id = ? AND m.destinataire_id = u.id)
           ORDER BY m.cree_le DESC LIMIT 1
        ) AS lastAt,
        (
          SELECT COUNT(*) FROM messages m
           WHERE m.expediteur_id = u.id AND m.destinataire_id = ? AND m.lu_le IS NULL
        ) AS unread
      FROM utilisateurs u
      WHERE u.id IN (${placeholders})
      ORDER BY (lastAt IS NULL), lastAt DESC, name ASC
    `,
    [user.id, user.id, user.id, user.id, user.id, ...contactIds]
  );

  return rows.map((r) => ({ ...r, unread: Number(r.unread) }));
}

export function buildConversationReadQuery(user, otherUserId) {
  const directionRestriction = user.role === "DIRECTION"
    ? `AND EXISTS (
         SELECT 1
           FROM utilisateurs contact
          WHERE contact.id = ?
            AND contact.role IN ('CONSEILLERE', 'COMPTABILITE')
            AND contact.statut = 'ACTIF'
       )`
    : "";

  return {
    sql: `
      SELECT id, expediteur_id AS senderId, contenu AS content,
             fichier_nom AS attachmentName, fichier_taille AS attachmentSize,
             lu_le AS readAt, cree_le AS createdAt
        FROM messages
       WHERE ((expediteur_id = ? AND destinataire_id = ?)
          OR (expediteur_id = ? AND destinataire_id = ?))
         ${directionRestriction}
       ORDER BY cree_le ASC, id ASC
    `,
    params: [
      user.id,
      otherUserId,
      otherUserId,
      user.id,
      ...(user.role === "DIRECTION" ? [otherUserId] : [])
    ]
  };
}

export async function getConversation({ user, otherUserId }) {
  await assertContact(user, otherUserId);

  if (!(await hasModernMessageSchema())) {
    return [];
  }

  const query = buildConversationReadQuery(user, otherUserId);
  const [messages] = await db.query(query.sql, query.params);

  await db.query(
    `UPDATE messages SET lu_le = NOW()
      WHERE destinataire_id = ? AND expediteur_id = ? AND lu_le IS NULL`,
    [user.id, otherUserId]
  );

  return messages;
}

export async function sendMessage({ user, recipientId, content, file }) {
  const contactIds = await getContactIds(user);
  assertAllowedMessageRecipient(user, recipientId, contactIds);

  if (!(await hasModernMessageSchema())) {
    throw createError("La messagerie n'est pas disponible sur cette base de donnees.", 501);
  }

  const cleanContent = String(content ?? "").trim();
  if (!cleanContent && !file) {
    throw createError("Le message ne peut pas etre vide.", 400);
  }
  if (cleanContent.length > 5000) {
    throw createError("Le message ne peut depasser 5000 caracteres.", 400);
  }

  const attachment = file ? await persistAttachment(file) : null;

  const [result] = await db.execute(
    `INSERT INTO messages (expediteur_id, destinataire_id, contenu, fichier_nom, fichier_chemin, fichier_mime, fichier_taille)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      recipientId,
      cleanContent,
      attachment?.fileName ?? null,
      attachment?.storedPath ?? null,
      attachment?.mimeType ?? null,
      attachment?.sizeBytes ?? null
    ]
  );

  try {
    const notificationText = `${user.fullName || "Un acteur"} vous a envoye un message.`;
    const alreadyNotified = await hasUnreadNotification(Number(recipientId), notificationText);
    if (!alreadyNotified) {
      await createNotificationForUsers(db, {
        title: "Nouveau message",
        message: notificationText,
        type: "MESSAGE",
        userIds: [Number(recipientId)],
        actionUrl: "/messages"
      });
    }
  } catch (notifError) {
    console.error("Notification de message non envoyee:", notifError.message);
  }

  return {
    id: result.insertId,
    senderId: user.id,
    content: cleanContent,
    attachmentName: attachment?.fileName ?? null,
    createdAt: new Date()
  };
}

export async function getAttachment({ user, messageId }) {
  if (!(await hasModernMessageSchema())) {
    throw createError("La messagerie n'est pas disponible sur cette base de donnees.", 501);
  }

  const [[message]] = await db.query(
    `SELECT expediteur_id, destinataire_id, fichier_nom, fichier_chemin, fichier_mime
       FROM messages WHERE id = ? LIMIT 1`,
    [messageId]
  );

  if (!message || !message.fichier_chemin) {
    throw createError("Piece jointe introuvable.", 404);
  }

  const allowed = [Number(message.expediteur_id), Number(message.destinataire_id)].includes(Number(user.id));
  if (!allowed) {
    throw createError("Acces refuse a cette piece jointe.", 403);
  }

  const absolutePath = path.resolve(messagesStorageRoot, message.fichier_chemin);
  if (!absolutePath.startsWith(messagesStorageRoot + path.sep)) {
    throw createError("Chemin de fichier invalide.", 400);
  }

  try {
    await fs.access(absolutePath);
  } catch {
    throw createError("Fichier absent du stockage.", 410);
  }

  return {
    absolutePath,
    fileName: message.fichier_nom || "fichier",
    mimeType: message.fichier_mime || "application/octet-stream"
  };
}

export function buildUnreadCountQuery(user) {
  if (user.role === "DIRECTION") {
    return {
      sql: `SELECT COUNT(*) AS n
              FROM messages m
              INNER JOIN utilisateurs sender
                ON sender.id = m.expediteur_id
             WHERE m.destinataire_id = ?
               AND m.lu_le IS NULL
               AND sender.role IN ('CONSEILLERE', 'COMPTABILITE')
               AND sender.statut = 'ACTIF'`,
      params: [user.id]
    };
  }

  return {
    sql: "SELECT COUNT(*) AS n FROM messages WHERE destinataire_id = ? AND lu_le IS NULL",
    params: [user.id]
  };
}

export async function countUnread(user) {
  if (!(await hasModernMessageSchema())) {
    return 0;
  }

  const query = buildUnreadCountQuery(user);
  const [[row]] = await db.query(query.sql, query.params);
  return Number(row.n);
}
