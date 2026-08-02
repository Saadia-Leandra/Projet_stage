export function createConversationRepo(db) {
  return {
    async createConversation({ subject, stageRequestId = null, contractId = null }) {
      const [result] = await db.execute(
        `
          INSERT INTO conversations (sujet, demande_stage_id, contrat_id)
          VALUES (?, ?, ?)
        `,
        [subject, stageRequestId, contractId]
      );

      return { id: result.insertId };
    },

    async findConversationsByUserId(userId) {
      const [rows] = await db.execute(
        `
          SELECT
            c.id,
            c.sujet AS subject,
            c.demande_stage_id AS stageRequestId,
            c.contrat_id AS contractId,
            c.cree_le AS createdAt,
            p.dernier_message_lu_id AS lastReadMessageId,
            p.rejoint_le AS joinedAt
          FROM conversations c
          JOIN participants_conversation p ON p.conversation_id = c.id
          WHERE p.utilisateur_id = ?
          ORDER BY c.cree_le DESC, c.id DESC
        `,
        [userId]
      );

      return rows;
    },

    async findConversationById(conversationId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            sujet AS subject,
            demande_stage_id AS stageRequestId,
            contrat_id AS contractId,
            cree_le AS createdAt
          FROM conversations
          WHERE id = ?
          LIMIT 1
        `,
        [conversationId]
      );

      return rows[0] || null;
    }
  };
}
