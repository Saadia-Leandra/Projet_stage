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

const router = Router();

router.use(requireLogin);
router.use(
  requireRole("SUPERVISEUR", "CONSEILLERE", "DIRECTION")
);

router.get("/contracts", async (req, res, next) => {
  try {
    const contracts = await getStageContractsForUser(
      req.user
    );

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
