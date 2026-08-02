export function createParticipantRepo(db) {
  return {
    async addParticipant({ conversationId, userId }) {
      const [result] = await db.execute(
        `
          INSERT INTO participants_conversation (conversation_id, utilisateur_id)
          VALUES (?, ?)
        `,
        [conversationId, userId]
      );

      return result.affectedRows > 0;
    },

    async isParticipant(conversationId, userId) {
      const [rows] = await db.execute(
        `
          SELECT 1
          FROM participants_conversation
          WHERE conversation_id = ? AND utilisateur_id = ?
          LIMIT 1
        `,
        [conversationId, userId]
      );

      return Boolean(rows[0]);
    },

    async getParticipants(conversationId) {
      const [rows] = await db.execute(
        `
          SELECT
            conversation_id AS conversationId,
            utilisateur_id AS userId,
            dernier_message_lu_id AS lastReadMessageId,
            rejoint_le AS joinedAt
          FROM participants_conversation
          WHERE conversation_id = ?
          ORDER BY rejoint_le ASC, utilisateur_id ASC
        `,
        [conversationId]
      );

      return rows;
    },

    async updateLastReadMessage({ conversationId, userId, messageId }) {
      const [result] = await db.execute(
        `
          UPDATE participants_conversation
          SET dernier_message_lu_id = ?
          WHERE conversation_id = ? AND utilisateur_id = ?
        `,
        [messageId, conversationId, userId]
      );

      return result.affectedRows > 0;
    }
  };
}
