export function createMessageRepo(db) {
  return {
    async createMessage({ conversationId, senderId, content }) {
      const [result] = await db.execute(
        `
          INSERT INTO messages (conversation_id, expediteur_id, contenu)
          VALUES (?, ?, ?)
        `,
        [conversationId, senderId, content]
      );

      return { id: result.insertId };
    },

    async findMessagesByConversationId(conversationId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            conversation_id AS conversationId,
            expediteur_id AS senderId,
            contenu AS content,
            envoye_le AS sentAt,
            modifie_le AS updatedAt
          FROM messages
          WHERE conversation_id = ?
          ORDER BY envoye_le ASC, id ASC
        `,
        [conversationId]
      );

      return rows;
    },

    async findLatestMessage(conversationId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            conversation_id AS conversationId,
            expediteur_id AS senderId,
            contenu AS content,
            envoye_le AS sentAt,
            modifie_le AS updatedAt
          FROM messages
          WHERE conversation_id = ?
          ORDER BY envoye_le DESC, id DESC
          LIMIT 1
        `,
        [conversationId]
      );

      return rows[0] || null;
    },

    async countUnreadMessages(conversationId, userId) {
      const [rows] = await db.execute(
        `
          SELECT COUNT(*) AS unreadCount
          FROM participants_conversation p
          JOIN messages m ON m.conversation_id = p.conversation_id
          WHERE p.conversation_id = ?
            AND p.utilisateur_id = ?
            AND m.expediteur_id != p.utilisateur_id
            AND m.id > COALESCE(p.dernier_message_lu_id, 0)
        `,
        [conversationId, userId]
      );

      return Number(rows[0]?.unreadCount || 0);
    }
  };
}
