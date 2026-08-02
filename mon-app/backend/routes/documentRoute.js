import { Router } from "express";

import { requireLogin } from "../middlewares/auth.js";
import { readMultipartFormData } from "../services/multipartService.js";
import {
  addDocumentVersion,
  addDossierComment,
  archiveDocument,
  createDocument,
  deleteDossierComment,
  getChecklist,
  getDocument,
  listAccessibleStageFiles,
  listDocumentHistory,
  listDocuments,
  listDossierComments,
  MAX_DOCUMENT_SIZE_BYTES,
  prepareDocumentDownload,
  setChecklistItem,
  updateDossierComment
} from "../services/documentService.js";

const router = Router();

router.use(requireLogin);

router.get("/stage-files", async (req, res, next) => {
  try {
    const stageFiles = await listAccessibleStageFiles(req.user);
    res.json({ stageFiles });
  } catch (error) {
    next(error);
  }
});

router.get("/checklist/:stageFileId", async (req, res, next) => {
  try {
    const checklist = await getChecklist({
      user: req.user,
      stageFileId: validateId(req.params.stageFileId, "Identifiant de dossier invalide.")
    });
    res.json({ checklist });
  } catch (error) {
    next(error);
  }
});

router.put("/checklist/:stageFileId", async (req, res, next) => {
  try {
    const item = await setChecklistItem({
      user: req.user,
      stageFileId: validateId(req.params.stageFileId, "Identifiant de dossier invalide."),
      type: req.body.type,
      done: Boolean(req.body.done)
    });
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

router.get("/stage/:stageFileId/comments", async (req, res, next) => {
  try {
    const comments = await listDossierComments({
      user: req.user,
      stageFileId: validateId(req.params.stageFileId, "Identifiant de dossier invalide.")
    });
    res.json({ comments });
  } catch (error) {
    next(error);
  }
});

router.post("/stage/:stageFileId/comments", async (req, res, next) => {
  try {
    const comment = await addDossierComment({
      user: req.user,
      stageFileId: validateId(req.params.stageFileId, "Identifiant de dossier invalide."),
      content: req.body.content,
      parentId: req.body.parentId ? validateId(req.body.parentId, "Commentaire parent invalide.") : null
    });
    res.status(201).json({ comment });
  } catch (error) {
    next(error);
  }
});

router.patch("/stage-comments/:commentId", async (req, res, next) => {
  try {
    const comment = await updateDossierComment({
      user: req.user,
      commentId: validateId(req.params.commentId, "Identifiant de commentaire invalide."),
      content: req.body.content
    });
    res.json({ comment });
  } catch (error) {
    next(error);
  }
});

router.delete("/stage-comments/:commentId", async (req, res, next) => {
  try {
    await deleteDossierComment({
      user: req.user,
      commentId: validateId(req.params.commentId, "Identifiant de commentaire invalide.")
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const stageFileId = validateId(req.query.stageFileId, "Identifiant de dossier invalide.");
    const documents = await listDocuments({
      user: req.user,
      stageFileId,
      type: req.query.type || null
    });
    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const multipart = await readMultipartFormData(req, {
      maxBytes: MAX_DOCUMENT_SIZE_BYTES + 1024 * 1024
    });
    const uploadedFile = multipart.files.file || Object.values(multipart.files)[0];
    const stageFileId = validateId(multipart.fields.stageFileId, "Identifiant de dossier invalide.");

    const document = await createDocument({
      user: req.user,
      stageFileId,
      type: multipart.fields.type,
      file: uploadedFile
    });

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
});

router.get("/:documentId", async (req, res, next) => {
  try {
    const documentId = validateId(req.params.documentId, "Identifiant de document invalide.");
    const document = await getDocument({ user: req.user, documentId });
    res.json({ document });
  } catch (error) {
    next(error);
  }
});

router.post("/:documentId/versions", async (req, res, next) => {
  try {
    const documentId = validateId(req.params.documentId, "Identifiant de document invalide.");
    const multipart = await readMultipartFormData(req, {
      maxBytes: MAX_DOCUMENT_SIZE_BYTES + 1024 * 1024
    });
    const uploadedFile = multipart.files.file || Object.values(multipart.files)[0];

    const version = await addDocumentVersion({
      user: req.user,
      documentId,
      file: uploadedFile
    });

    res.status(201).json({ version });
  } catch (error) {
    next(error);
  }
});

router.get("/:documentId/download", async (req, res, next) => {
  try {
    const documentId = validateId(req.params.documentId, "Identifiant de document invalide.");
    const file = await prepareDocumentDownload({ user: req.user, documentId });

    res
      .set("Content-Type", file.mimeType)
      .set("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName)}"`)
      .sendFile(file.absolutePath);
  } catch (error) {
    next(error);
  }
});

router.delete("/:documentId", async (req, res, next) => {
  try {
    const documentId = validateId(req.params.documentId, "Identifiant de document invalide.");
    await archiveDocument({ user: req.user, documentId });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/:documentId/history", async (req, res, next) => {
  try {
    const documentId = validateId(req.params.documentId, "Identifiant de document invalide.");
    const history = await listDocumentHistory({ user: req.user, documentId });
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

function validateId(value, message) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }

  return id;
}

export default router;
