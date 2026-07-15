import { Router } from "express";

import {
  requireLogin,
  requireRole
} from "../middlewares/auth.js";

import {
  approveStageRequest,
  getSupervisorStageRequestById,
  getSupervisorStageRequests,
  refuseStageRequest
} from "../services/supervisorStageService.js";

const router = Router();

router.use(requireLogin);
router.use(requireRole("SUPERVISEUR"));

router.get(
  "/requests",
  async (req, res, next) => {
    try {
      const requests =
        await getSupervisorStageRequests(
          req.user.id
        );

      res.json({ requests });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/requests/:requestId",
  async (req, res, next) => {
    try {
      const requestId = validateRequestId(
        req.params.requestId
      );

      const request =
        await getSupervisorStageRequestById(
          req.user.id,
          requestId
        );

      res.json({ request });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/requests/:requestId/approve",
  async (req, res, next) => {
    try {
      const requestId = validateRequestId(
        req.params.requestId
      );

      const result =
        await approveStageRequest(
          req.user.id,
          requestId
        );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/requests/:requestId/refuse",
  async (req, res, next) => {
    try {
      const requestId = validateRequestId(
        req.params.requestId
      );

      const result =
        await refuseStageRequest(
          req.user.id,
          requestId,
          req.body.refusalReason
        );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

function validateRequestId(value) {
  const requestId = Number(value);

  if (
    !Number.isInteger(requestId) ||
    requestId <= 0
  ) {
    const error = new Error(
      "Identifiant de demande invalide."
    );

    error.status = 400;

    throw error;
  }

  return requestId;
}

export default router;