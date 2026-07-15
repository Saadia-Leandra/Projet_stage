import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";

export default function payrollRoutes({ payrollRepo }) {
  const router = Router();

  router.use(requireLogin);

  router.get(
    "/settings",
    requireRole("SUPERVISEUR"),
    async (req, res, next) => {
      try {
        res.json(await payrollRepo.getSupervisorPayrollSettings(req.user.id));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/supervisors",
    requireRole("SUPERVISEUR", "CONSEILLERE", "COMPTABILITE", "DIRECTION"),
    async (req, res, next) => {
      try {
        res.json({
          supervisors: await payrollRepo.listSupervisorTotals({ user: req.user })
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/supervision-charges",
    requireRole("SUPERVISEUR", "CONSEILLERE", "COMPTABILITE", "DIRECTION"),
    async (req, res, next) => {
      try {
        res.json({
          charges: await payrollRepo.listSupervisionCharges({ user: req.user })
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/supervision-charges",
    requireRole("SUPERVISEUR"),
    async (req, res, next) => {
      try {
        const charge = await payrollRepo.createSupervisionCharge({
          supervisorUserId: req.user.id,
          data: req.body
        });

        res.status(201).json({ charge });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/supervision-charges/:id/status",
    requireRole("COMPTABILITE", "DIRECTION"),
    async (req, res, next) => {
      try {
        await payrollRepo.updateSupervisionChargeStatus({
          id: req.params.id,
          status: req.body.status
        });

        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
