import { Router } from "express";

import {
  requireLogin,
  requireRole
} from "../middlewares/auth.js";

import {
  generateStudentContractPdf,
  getStudentContractById,
  getStudentContractFile,
  getStudentContractReceipt,
  getStudentContracts,
  MAX_MILIEU_SIGNED_PDF_SIZE_BYTES,
  submitStudentContract,
  uploadMilieuSignedContract,
  updateStudentContract
} from "../services/contractService.js";
import { readMultipartFormData } from "../services/multipartService.js";

const router = Router();

router.use(requireLogin);
router.use(requireRole("ETUDIANT"));

router.get("/", async (req, res, next) => {
  try {
    const contracts = await getStudentContracts(
      req.user.id
    );

    res.json({ contracts });
  } catch (error) {
    next(error);
  }
});

router.get("/:contractId", async (req, res, next) => {
  try {
    const contractId = validateContractId(
      req.params.contractId
    );

    const contract = await getStudentContractById(
      req.user.id,
      contractId
    );

    res.json({ contract });
  } catch (error) {
    next(error);
  }
});

router.put("/:contractId", async (req, res, next) => {
  try {
    const contractId = validateContractId(
      req.params.contractId
    );

    const contract = await updateStudentContract(
      req.user.id,
      contractId,
      req.body
    );

    res.json({ contract });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/:contractId/generate-pdf",
  async (req, res, next) => {
    try {
      const contractId = validateContractId(
        req.params.contractId
      );

      const contract = await generateStudentContractPdf(
        req.user.id,
        contractId
      );

      res.json({ contract });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:contractId/submit",
  async (req, res, next) => {
    try {
      const contractId = validateContractId(
        req.params.contractId
      );

      const contract = await submitStudentContract(
        req.user.id,
        contractId
      );

      res.json({ contract });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/:contractId/milieu-signed-document",
  async (req, res, next) => {
    try {
      const contractId = validateContractId(
        req.params.contractId
      );
      const multipart =
        await readMultipartFormData(req, {
          maxBytes:
            MAX_MILIEU_SIGNED_PDF_SIZE_BYTES +
            1024 * 1024
        });
      const uploadedFile =
        multipart.files.file ||
        Object.values(multipart.files)[0];

      const contract =
        await uploadMilieuSignedContract(
          req.user.id,
          contractId,
          {
            originalName: uploadedFile?.fileName,
            mimeType: uploadedFile?.contentType,
            size: uploadedFile?.buffer.length,
            buffer: uploadedFile?.buffer
          }
        );

      res.status(201).json({ contract });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:contractId/receipt",
  async (req, res, next) => {
    try {
      const contractId = validateContractId(
        req.params.contractId
      );

      const receipt = await getStudentContractReceipt(
        req.user.id,
        contractId
      );

      res.json({ receipt });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:contractId/download",
  async (req, res, next) => {
    try {
      const contractId = validateContractId(
        req.params.contractId
      );

      const type =
        req.query.type === "original"
          ? "original"
          : "signed";

      const file = await getStudentContractFile(
        req.user.id,
        contractId,
        type
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

function validateContractId(value) {
  const contractId = Number(value);

  if (
    !Number.isInteger(contractId) ||
    contractId <= 0
  ) {
    const error = new Error(
      "Identifiant de contrat invalide."
    );
    error.status = 400;
    throw error;
  }

  return contractId;
}

export default router;
