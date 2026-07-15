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

  router.get(
    "/reports/supervisors/:id.csv",
    requireRole("SUPERVISEUR", "COMPTABILITE", "DIRECTION"),
    async (req, res, next) => {
      try {
        const report = await payrollRepo.getSupervisorPayrollReport({
          supervisorId: req.params.id,
          user: req.user
        });
        const fileName = `rapport-paie-${report.supervisor.employeeNumber || req.params.id}.csv`;

        res
          .set("Content-Type", "text/csv; charset=utf-8")
          .set("Content-Disposition", `attachment; filename="${fileName}"`)
          .send(`\uFEFF${createPayrollCsv(report)}`);
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

function createPayrollCsv({ supervisor, charges, trips }) {
  const supervisionTotal = charges.reduce((sum, row) => sum + Number(row.amount), 0);
  const mileageTotal = trips.reduce((sum, row) => sum + Number(row.amount), 0);
  const supervisionHours = charges.reduce((sum, row) => sum + Number(row.hours), 0);
  const distanceKm = trips.reduce((sum, row) => sum + Number(row.distanceKm), 0);
  const studentCount = new Set(charges.map((row) => row.studentCode)).size;
  const rows = [
    ["RAPPORT RECAPITULATIF DE PAIE"],
    [],
    ["Enseignant", supervisor.supervisorName],
    ["Numero d'employe", supervisor.employeeNumber],
    ["Courriel", supervisor.supervisorEmail],
    ["Date d'export", new Date().toISOString().slice(0, 10)],
    [],
    ["RECAPITULATIF"],
    ["Nombre d'etudiants", studentCount],
    ["Nombre de charges", charges.length],
    ["Total des heures de supervision", supervisionHours],
    ["Montant de supervision", supervisionTotal],
    ["Nombre de deplacements", trips.length],
    ["Distance totale (km)", distanceKm],
    ["Montant de kilometrage", mileageTotal],
    ["TOTAL DE LA PAIE", supervisionTotal + mileageTotal],
    [],
    ["DETAIL DES CHARGES DE SUPERVISION"],
    ["Date", "No dossier", "Code etudiant", "Etudiant", "Cours, groupe, session et commentaires", "Heures", "Taux horaire", "Montant", "Statut"],
    ...charges.map((row) => [
      row.createdAt,
      row.stageFileId,
      row.studentCode,
      row.studentName,
      row.comment,
      row.hours,
      row.hourlyRate,
      row.amount,
      row.status
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

function csvCell(value = "") {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}
