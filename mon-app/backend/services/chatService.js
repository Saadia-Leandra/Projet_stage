export class ChatService {
  constructor({ chatRepo }) {
    this.chatRepo = chatRepo;
  }

  async createConversation({ userId, subject, participantIds = [], requestId = null, contractId = null }) {
    const creatorId = validId(userId, "Utilisateur invalide.");
    const cleanSubject = String(subject || "").trim();
    if (!cleanSubject) throw httpError("Le sujet de la conversation est requis.", 400);

    return this.chatRepo.createConversation({
      subject: cleanSubject,
      requestId: optionalId(requestId, "Demande de stage invalide."),
      contractId: optionalId(contractId, "Contrat invalide."),
      participantIds: uniqueIds([creatorId, ...participantIds])
    });
  }

  async addParticipants({ conversationId, userId, participantIds = [] }) {
    const ids = uniqueIds(participantIds);
    if (!ids.length) throw httpError("Au moins un participant est requis.", 400);
    const conversation = validId(conversationId, "Conversation invalide.");
    await this.assertParticipant(conversation, userId);
    return this.chatRepo.addParticipants(conversation, ids);
  }

  async isParticipant(conversationId, userId) {
    return this.chatRepo.isParticipant(
      validId(conversationId, "Conversation invalide."),
      validId(userId, "Utilisateur invalide.")
    );
  }

  async assertParticipant(conversationId, userId) {
    const authorized = await this.isParticipant(conversationId, userId);
    if (!authorized) throw httpError("Accès interdit à cette conversation.", 403);
    return true;
  }

  async getUserConversations(userId) {
    return this.chatRepo.listConversationsByUser(validId(userId, "Utilisateur invalide."));
  }

  async getConversation({ conversationId, userId }) {
    const id = validId(conversationId, "Conversation invalide.");
    await this.assertParticipant(id, userId);
    const conversation = await this.chatRepo.findConversationById(id);
    if (!conversation) throw httpError("Conversation introuvable.", 404);
    return conversation;
  }

  async getMessages({ conversationId, userId }) {
    const id = validId(conversationId, "Conversation invalide.");
    await this.assertParticipant(id, userId);
    return this.chatRepo.listMessages(id);
  }

  async sendMessage({ conversationId, userId, content }) {
    const id = validId(conversationId, "Conversation invalide.");
    const senderId = validId(userId, "Utilisateur invalide.");
    const cleanContent = String(content || "").trim();
    if (!cleanContent) throw httpError("Le contenu du message est requis.", 400);
    await this.assertParticipant(id, senderId);
    return this.chatRepo.createMessage({ conversationId: id, senderId, content: cleanContent });
  }

  async markConversationRead({ conversationId, userId, messageId = null }) {
    const id = validId(conversationId, "Conversation invalide.");
    const readerId = validId(userId, "Utilisateur invalide.");
    await this.assertParticipant(id, readerId);
    const normalizedMessageId = optionalId(messageId, "Message invalide.");
    if (normalizedMessageId !== null &&
        !await this.chatRepo.messageBelongsToConversation(normalizedMessageId, id)) {
      throw httpError("Ce message n'appartient pas à la conversation.", 400);
    }
    await this.chatRepo.markRead(id, readerId, normalizedMessageId);
    return { conversationId: id, unreadCount: 0 };
  }

  async getUnreadCount({ userId, conversationId = null }) {
    const id = conversationId === null || conversationId === undefined
      ? null
      : validId(conversationId, "Conversation invalide.");
    const normalizedUserId = validId(userId, "Utilisateur invalide.");
    if (id !== null) await this.assertParticipant(id, normalizedUserId);
    return this.chatRepo.countUnread(normalizedUserId, id);
  }
}

function validId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(message, 400);
  return id;
}

function optionalId(value, message) {
  return value === null || value === undefined || value === "" ? null : validId(value, message);
}

function uniqueIds(values) {
  return [...new Set(values.map((value) => validId(value, "Participant invalide.")))];
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
