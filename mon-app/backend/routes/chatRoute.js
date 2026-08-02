import { Router } from "express";
import { requireLogin } from "../middlewares/auth.js";

export default function chatRoutes({ chatService }) {
  const router = Router();

  router.use(requireLogin);

  router.get("/conversations", async (req, res, next) => {
    try {
      const conversations = await chatService.getUserConversations(req.user.id);
      res.json({ conversations });
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversations", async (req, res, next) => {
    try {
      validateConversationPayload(req.body);
      const conversation = await chatService.createConversation({
        userId: req.user.id,
        subject: req.body.subject,
        participantIds: req.body.participantIds,
        requestId: req.body.requestId,
        contractId: req.body.contractId
      });
      res.status(201).json({ conversation });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:id/messages", async (req, res, next) => {
    try {
      const conversationId = parseId(req.params.id, "Identifiant de conversation invalide.");
      const messages = await chatService.getMessages({
        conversationId,
        userId: req.user.id
      });
      res.json({ messages });
    } catch (error) {
      next(error);
    }
  });

  router.post("/conversations/:id/messages", async (req, res, next) => {
    try {
      const conversationId = parseId(req.params.id, "Identifiant de conversation invalide.");
      validateMessageContent(req.body?.content);
      const message = await chatService.sendMessage({
        conversationId,
        userId: req.user.id,
        content: req.body.content
      });
      res.status(201).json({ message });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/conversations/:id/read", async (req, res, next) => {
    try {
      const conversationId = parseId(req.params.id, "Identifiant de conversation invalide.");
      const messageId = req.body?.messageId === undefined || req.body.messageId === null
        ? null
        : parseId(req.body.messageId, "Identifiant de message invalide.");
      const result = await chatService.markConversationRead({
        conversationId,
        userId: req.user.id,
        messageId
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function validateConversationPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError("Corps de requête invalide.", 400);
  }
  if (typeof body.subject !== "string" || !body.subject.trim()) {
    throw httpError("Le sujet de la conversation est requis.", 400);
  }
  if (body.subject.trim().length > 255) {
    throw httpError("Le sujet ne peut pas dépasser 255 caractères.", 400);
  }
  if (body.participantIds !== undefined && !Array.isArray(body.participantIds)) {
    throw httpError("La liste des participants est invalide.", 400);
  }
  for (const participantId of body.participantIds || []) {
    parseId(participantId, "Identifiant de participant invalide.");
  }
  if (body.requestId !== undefined && body.requestId !== null) {
    parseId(body.requestId, "Identifiant de demande invalide.");
  }
  if (body.contractId !== undefined && body.contractId !== null) {
    parseId(body.contractId, "Identifiant de contrat invalide.");
  }
}

function validateMessageContent(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw httpError("Le contenu du message est requis.", 400);
  }
  if (content.trim().length > 2000) {
    throw httpError("Le message ne peut pas dépasser 2000 caractères.", 400);
  }
}

function parseId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(message, 400);
  return id;
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
