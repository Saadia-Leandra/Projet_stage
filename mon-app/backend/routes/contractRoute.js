import { Router } from "express";

import {
  requireLogin,
  requireRole
} from "../middlewares/auth.js";

import {
  getStudentContractById,
  getStudentContractFile,
  getStudentContracts,
  submitStudentContract,
  updateStudentContract
} from "../services/contractService.js";

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
