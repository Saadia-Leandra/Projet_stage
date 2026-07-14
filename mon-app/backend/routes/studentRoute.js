import { Router } from "express";
import {
  requireLogin,
  requireRole
} from "../middlewares/auth.js";

import {
  createInternshipRequest,
  getStudentDashboard,
  getStudentRequests
} from "../services/studentService.js";

import {
  updateInternshipRequest
} from "../services/studentRequestUpdateService.js";

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

export default router;