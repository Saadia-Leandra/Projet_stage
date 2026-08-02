import { Router } from "express";

import { requireLogin } from "../middlewares/auth.js";
import { readMultipartFormData } from "../services/multipartService.js";
import {
  countUnread,
  getAttachment,
  getConversation,
  listContacts,
  MAX_ATTACHMENT_SIZE_BYTES,
  sendMessage
} from "../services/messageService.js";

const router = Router();

router.use(requireLogin);

router.get("/contacts", async (req, res, next) => {
  try {
    const contacts = await listContacts(req.user);
    res.json({ contacts });
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", async (req, res, next) => {
  try {
    const count = await countUnread(req.user);
    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.get("/conversation/:userId", async (req, res, next) => {
  try {
    const messages = await getConversation({
      user: req.user,
      otherUserId: validateId(req.params.userId)
    });
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

router.get("/attachment/:messageId", async (req, res, next) => {
  try {
    const file = await getAttachment({
      user: req.user,
      messageId: validateId(req.params.messageId)
    });

    res
      .set("Content-Type", file.mimeType)
      .set("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`)
      .sendFile(file.absolutePath);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const contentType = req.headers["content-type"] || "";
    let recipientId;
    let content;
    let file = null;

    if (contentType.includes("multipart/form-data")) {
      const multipart = await readMultipartFormData(req, {
        maxBytes: MAX_ATTACHMENT_SIZE_BYTES + 1024 * 1024
      });
      const uploaded = multipart.files.file || Object.values(multipart.files)[0];
      recipientId = validateId(multipart.fields.recipientId);
      content = multipart.fields.content;
      if (uploaded?.buffer?.length) {
        file = uploaded;
      }
    } else {
      recipientId = validateId(req.body.recipientId);
      content = req.body.content;
    }

    const message = await sendMessage({ user: req.user, recipientId, content, file });
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
});

function validateId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Identifiant de destinataire invalide.");
    error.status = 400;
    throw error;
  }
  return id;
}

export default router;
