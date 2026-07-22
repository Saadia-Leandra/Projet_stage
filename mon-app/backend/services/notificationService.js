import { createDbPool } from "../config/db.js";

const db = createDbPool();

export async function createNotificationForUsers(
  connection,
  {
    title,
    message,
    type,
    userIds,
    requestId = null,
    contractId = null,
    actionUrl = null
  }
) {
  const recipients = [...new Set(
    userIds
      .map((userId) => Number(userId))
      .filter((userId) =>
        Number.isInteger(userId) && userId > 0
      )
  )];

  if (!recipients.length) {
    return null;
  }

  const [notificationResult] =
    await connection.execute(
      `
        INSERT INTO notifications (
          titre,
          message,
          type_notification,
          demande_stage_id,
          contrat_id,
          lien_action
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        title,
        message,
        type,
        normalizeNullableId(requestId),
        normalizeNullableId(contractId),
        normalizeActionUrl(actionUrl)
      ]
    );

  for (const userId of recipients) {
    await connection.execute(
      `
        INSERT IGNORE INTO destinataires_notification (
          notification_id,
          utilisateur_destinataire_id
        )
        VALUES (?, ?)
      `,
      [notificationResult.insertId, userId]
    );
  }

  return notificationResult.insertId;
}

export async function getUserNotifications(userId) {
  const [rows] = await db.execute(
    `
      SELECT
        n.id,
        n.titre AS title,
        n.message,
        n.type_notification AS type,
        n.demande_stage_id AS requestId,
        n.contrat_id AS contractId,
        n.lien_action AS actionUrl,
        n.cree_le AS createdAt,
        dn.lu_le AS readAt

      FROM destinataires_notification dn

      INNER JOIN notifications n
        ON n.id = dn.notification_id

      WHERE dn.utilisateur_destinataire_id = ?

      ORDER BY n.cree_le DESC

      LIMIT 20
    `,
    [userId]
  );

  return rows;
}

function normalizeNullableId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeActionUrl(value) {
  const actionUrl = String(value || "").trim();

  return actionUrl || null;
}

export async function markNotificationRead(
  userId,
  notificationId
) {
  const [result] = await db.execute(
    `
      UPDATE destinataires_notification
      SET lu_le = COALESCE(lu_le, NOW())
      WHERE utilisateur_destinataire_id = ?
        AND notification_id = ?
    `,
    [userId, notificationId]
  );

  if (!result.affectedRows) {
    const error = new Error("Notification introuvable.");
    error.status = 404;
    throw error;
  }
}
