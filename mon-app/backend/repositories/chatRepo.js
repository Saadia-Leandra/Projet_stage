export function createChatRepo(db) {
  return {
    async createConversation({ subject, requestId = null, contractId = null, participantIds }) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [result] = await connection.execute(
          `INSERT INTO conversations (sujet, demande_stage_id, contrat_id) VALUES (?, ?, ?)`,
          [subject, requestId, contractId]
        );
        for (const userId of participantIds) {
          await connection.execute(
            `INSERT INTO participants_conversation (conversation_id, utilisateur_id) VALUES (?, ?)`,
            [result.insertId, userId]
          );
        }
        await connection.commit();
        return this.findConversationById(result.insertId, connection);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findConversationById(conversationId, executor = db) {
      const [rows] = await executor.execute(
        `SELECT id, sujet AS subject, demande_stage_id AS requestId,
                contrat_id AS contractId, cree_le AS createdAt
         FROM conversations WHERE id = ? LIMIT 1`,
        [conversationId]
      );
      return rows[0] || null;
    },

    async isParticipant(conversationId, userId) {
      const [rows] = await db.execute(
        `SELECT 1 FROM participants_conversation
         WHERE conversation_id = ? AND utilisateur_id = ? LIMIT 1`,
        [conversationId, userId]
      );
      return Boolean(rows[0]);
    },

    async addParticipants(conversationId, participantIds) {
      for (const userId of participantIds) {
        await db.execute(
          `INSERT IGNORE INTO participants_conversation (conversation_id, utilisateur_id)
           VALUES (?, ?)`,
          [conversationId, userId]
        );
      }
      return this.listParticipants(conversationId);
    },

    async listParticipants(conversationId) {
      const [rows] = await db.execute(
        `SELECT utilisateur_id AS userId, rejoint_le AS joinedAt
         FROM participants_conversation WHERE conversation_id = ? ORDER BY rejoint_le, utilisateur_id`,
        [conversationId]
      );
      return rows;
    },

    async listConversationsByUser(userId) {
      const [rows] = await db.execute(
        `SELECT c.id, c.sujet AS subject, c.demande_stage_id AS requestId,
                c.contrat_id AS contractId, c.cree_le AS createdAt,
                COUNT(m.id) AS unreadCount
         FROM participants_conversation pc
         INNER JOIN conversations c ON c.id = pc.conversation_id
         LEFT JOIN messages m ON m.conversation_id = c.id
           AND m.id > COALESCE(pc.dernier_message_lu_id, 0)
           AND m.expediteur_id <> pc.utilisateur_id
         WHERE pc.utilisateur_id = ?
         GROUP BY c.id, c.sujet, c.demande_stage_id, c.contrat_id, c.cree_le
         ORDER BY COALESCE(MAX(m.envoye_le), c.cree_le) DESC`,
        [userId]
      );
      return rows.map((row) => ({ ...row, unreadCount: Number(row.unreadCount) }));
    },

    async listMessages(conversationId) {
      const [rows] = await db.execute(
        `SELECT id, conversation_id AS conversationId, expediteur_id AS senderId,
                contenu AS content, envoye_le AS sentAt, modifie_le AS updatedAt
         FROM messages WHERE conversation_id = ? ORDER BY envoye_le, id`,
        [conversationId]
      );
      return rows;
    },

    async createMessage({ conversationId, senderId, content }) {
      const [result] = await db.execute(
        `INSERT INTO messages (conversation_id, expediteur_id, contenu) VALUES (?, ?, ?)`,
        [conversationId, senderId, content]
      );
      const [rows] = await db.execute(
        `SELECT id, conversation_id AS conversationId, expediteur_id AS senderId,
                contenu AS content, envoye_le AS sentAt, modifie_le AS updatedAt
         FROM messages WHERE id = ?`,
        [result.insertId]
      );
      return rows[0];
    },

    async messageBelongsToConversation(messageId, conversationId) {
      const [rows] = await db.execute(
        `SELECT 1 FROM messages WHERE id = ? AND conversation_id = ? LIMIT 1`,
        [messageId, conversationId]
      );
      return Boolean(rows[0]);
    },

    async markRead(conversationId, userId, messageId = null) {
      await db.execute(
        `UPDATE participants_conversation pc
         SET dernier_message_lu_id = COALESCE(?, (
           SELECT MAX(m.id) FROM messages m WHERE m.conversation_id = pc.conversation_id
         ))
         WHERE pc.conversation_id = ? AND pc.utilisateur_id = ?`,
        [messageId, conversationId, userId]
      );
    },

    async countUnread(userId, conversationId = null) {
      const params = [userId];
      const conversationFilter = conversationId === null ? "" : " AND pc.conversation_id = ?";
      if (conversationId !== null) params.push(conversationId);
      const [rows] = await db.execute(
        `SELECT COUNT(m.id) AS unreadCount
         FROM participants_conversation pc
         INNER JOIN messages m ON m.conversation_id = pc.conversation_id
           AND m.id > COALESCE(pc.dernier_message_lu_id, 0)
           AND m.expediteur_id <> pc.utilisateur_id
         WHERE pc.utilisateur_id = ?${conversationFilter}`,
        params
      );
      return Number(rows[0]?.unreadCount || 0);
    }
  };
}
