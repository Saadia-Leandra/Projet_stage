import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import { createPayrollPdf } from "../services/payrollPdfService.js";

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
    requireRole("SUPERVISEUR", "CONSEILLERE", "COMPTABILITE"),
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

  router.get(
    "/reports/supervisors/:id.pdf",
    requireRole("SUPERVISEUR", "CONSEILLERE", "COMPTABILITE"),
    async (req, res, next) => {
      try {
        const report = await payrollRepo.getSupervisorPayrollReport({
          supervisorId: req.params.id,
          user: req.user
        });
        const fileName = `rapport-paie-${report.supervisor.employeeNumber || req.params.id}.pdf`;
        const pdf = await createPayrollPdf(report);

        res
          .set("Content-Type", "application/pdf")
          .set("Content-Disposition", `attachment; filename="${fileName}"`)
          .send(pdf);
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
        const studentCodes = Array.isArray(req.body.studentCodes)
          ? [...new Set(req.body.studentCodes)]
          : [req.body.studentCode];
        if (!studentCodes.length || studentCodes.some((code) => !String(code || "").trim())) {
          const error = new Error("Selectionnez au moins un etudiant.");
          error.status = 400;
          throw error;
        }
        const charges = [];
        for (const studentCode of studentCodes) {
          charges.push(await payrollRepo.createSupervisionCharge({
            supervisorUserId: req.user.id,
            data: { ...req.body, studentCode }
          }));
        }

        res.status(201).json({ charge: charges[0], charges });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/supervision-charges/:id/status",
    requireRole("COMPTABILITE"),
    async (req, res, next) => {
      try {
        await payrollRepo.updateSupervisionChargeStatus({
          id: req.params.id,
          status: req.body.status,
          refusalReason: req.body.refusalReason
        });

        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/supervision-charges/:id/resubmit",
    requireRole("SUPERVISEUR"),
    async (req, res, next) => {
      try {
        const charge = await payrollRepo.resubmitSupervisionCharge({
          id: req.params.id,
          supervisorUserId: req.user.id,
          data: req.body
        });
        res.json({
          message: "Charge corrigée et resoumise à la comptabilité.",
          charge
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

