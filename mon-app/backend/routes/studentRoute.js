import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import {
  createInternshipRequest,
  getStudentDashboard,
  getStudentRequests
} from "../services/studentService.js";

const router = Router();

router.use(requireLogin);
router.use(requireRole("ETUDIANT"));

router.get("/dashboard", async (req, res, next) => {
  try {
    const dashboard = await getStudentDashboard(req.user.id);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

router.get("/requests", async (req, res, next) => {
  try {
    const requests = await getStudentRequests(req.user.id);
    res.json({ requests });
  } catch (error) {
    next(error);
  }
});

router.post("/requests", async (req, res, next) => {
  try {
    const request = await createInternshipRequest(req.user.id, req.body);
    res.status(201).json({ request });
  } catch (error) {
    next(error);
  }
});

export default router;
