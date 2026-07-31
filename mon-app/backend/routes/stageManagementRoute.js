import { Router } from "express";

import {
  requireLogin,
  requireRole
} from "../middlewares/auth.js";

import {
  getStageContractForUser,
  getStageContractsForUser,
  getStageRequestsForUser
} from "../services/stageManagementService.js";
import {
  syncContractDocumensoStatusForUser,
  syncPendingDocumensoContractsForUser
} from "../services/contractService.js";
import {
  getDocumensoDiagnostic
} from "../services/documensoService.js";

const router = Router();

router.use(requireLogin);
router.use(
  requireRole("SUPERVISEUR", "CONSEILLERE", "DIRECTION")
);

router.get("/contracts", async (req, res, next) => {
  try {
    let contracts = await getStageContractsForUser(
      req.user
    );

    if (
      await syncPendingDocumensoContractsForUser(
        req.user,
        contracts
      )
    ) {
      contracts = await getStageContractsForUser(
        req.user
      );
    }

    res.json({ contracts });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/contracts/:contractId",
  async (req, res, next) => {
    try {
      const contractId = validateId(
        req.params.contractId,
        "Identifiant de contrat invalide."
      );

      const contract = await getStageContractForUser(
        req.user,
        contractId
      );

      res.json({ contract });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/contracts/:contractId/sync-documenso",
  async (req, res, next) => {
    try {
      const contractId = validateId(
        req.params.contractId,
        "Identifiant de contrat invalide."
      );

      await syncContractDocumensoStatusForUser(
        req.user,
        contractId
      );

      let contract = await getStageContractForUser(
        req.user,
        contractId
      );

      if (
        await syncPendingDocumensoContractsForUser(
          req.user,
          [contract]
        )
      ) {
        contract = await getStageContractForUser(
          req.user,
          contractId
        );
      }

      res.json({ contract });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/requests", async (req, res, next) => {
  try {
    const requests = await getStageRequestsForUser(
      req.user
    );

    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

router.get("/documenso/diagnostic", async (req, res, next) => {
  try {
    const diagnostic = await getDocumensoDiagnostic();

    res.json({ diagnostic });
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
