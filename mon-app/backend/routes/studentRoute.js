import { Router } from "express";
import {
  requireLogin,
  requireRole
} from "../middlewares/auth.js";
import { readMultipartFormData } from "../services/multipartService.js";

import {
  createInternshipRequest,
  getStudentDashboard,
  getStudentRequestFile,
  getStudentRequests
} from "../services/studentService.js";

import {
  updateInternshipRequest
} from "../services/studentRequestUpdateService.js";

import {
  MAX_REQUEST_DOCUMENT_SIZE_BYTES,
  addStudentRequestDocument,
  deleteStudentRequestDocument,
  getStudentRequestDocumentFile,
  listStudentRequestDocuments
} from "../services/stageRequestCorrectionService.js";

const router = Router();

router.use(requireLogin);
router.use(requireRole("ETUDIANT"));

router.get(
  "/dashboard",
  async (req, res, next) => {
    try {
      const dashboard =
        await getStudentDashboard(req.user.id);

      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/requests",
  async (req, res, next) => {
    try {
      const requests =
        await getStudentRequests(req.user.id);

      res.json({ requests });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/requests",
  async (req, res, next) => {
    try {
      const request =
        await createInternshipRequest(
          req.user.id,
          req.body
        );

      res.status(201).json({ request });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/requests/:requestId",
  async (req, res, next) => {
    try {
      const requestId = Number(
        req.params.requestId
      );

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return res.status(400).json({
          error:
            "Identifiant de demande invalide."
        });
      }

      const request =
        await updateInternshipRequest(
          req.user.id,
          requestId,
          req.body
        );

      res.json({ request });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/requests/:requestId/download",
  async (req, res, next) => {
    try {
      const requestId = Number(req.params.requestId);

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return res.status(400).json({
          error:
            "Identifiant de demande invalide."
        });
      }

      const file = await getStudentRequestFile(
        req.user.id,
        requestId
      );

      res
        .set("Content-Type", "application/pdf")
        .set(
          "Content-Disposition",
          `attachment; filename="${file.fileName}"`
        )
        .sendFile(file.absolutePath);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/requests/:requestId/documents",
  async (req, res, next) => {
    try {
      const requestId = validatePositiveId(
        req.params.requestId
      );

      const documents =
        await listStudentRequestDocuments(
          req.user.id,
          requestId
        );

      res.json({ documents });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/requests/:requestId/documents",
  async (req, res, next) => {
    try {
      const requestId = validatePositiveId(
        req.params.requestId
      );
      const multipart =
        await readMultipartFormData(req, {
          maxBytes:
            MAX_REQUEST_DOCUMENT_SIZE_BYTES +
            1024 * 1024
        });
      const uploadedFile =
        multipart.files.file ||
        Object.values(multipart.files)[0];

      const document =
        await addStudentRequestDocument(
          req.user.id,
          requestId,
          {
            documentType:
              multipart.fields.documentType,
            originalName:
              uploadedFile?.fileName,
            mimeType:
              uploadedFile?.contentType,
            size: uploadedFile?.buffer.length,
            buffer: uploadedFile?.buffer
          }
        );

      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  "/requests/:requestId/documents/:documentId",
  async (req, res, next) => {
    try {
      const requestId = validatePositiveId(
        req.params.requestId
      );
      const documentId = validatePositiveId(
        req.params.documentId
      );

      const document =
        await deleteStudentRequestDocument(
          req.user.id,
          requestId,
          documentId
        );

      res.json({ document });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/requests/:requestId/documents/:documentId/download",
  async (req, res, next) => {
    try {
      const requestId = validatePositiveId(
        req.params.requestId
      );
      const documentId = validatePositiveId(
        req.params.documentId
      );

      const file =
        await getStudentRequestDocumentFile(
          req.user.id,
          requestId,
          documentId
        );

      res
        .set(
          "Content-Type",
          file.mimeType || "application/octet-stream"
        )
        .set(
          "Content-Disposition",
          `attachment; filename="${file.fileName}"`
        )
        .sendFile(file.absolutePath);
    } catch (error) {
      next(error);
    }
  }
);

function validatePositiveId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(
      "Identifiant invalide."
    );
    error.status = 400;
    throw error;
  }

  return id;
}

export default router;
