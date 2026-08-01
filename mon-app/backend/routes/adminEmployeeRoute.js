import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";

const EMPLOYEE_ROLES = new Set(["SUPERVISEUR", "CONSEILLERE", "COMPTABILITE"]);

export default function adminEmployeeRoutes({ db }) {
  const router = Router();
  router.use(requireLogin);
  router.use(requireRole("DIRECTION"));

  router.get("/", async (_req, res, next) => {
    try {
      const [employees] = await db.execute(`
        SELECT u.id AS userId, u.nom, u.prenom, u.courriel, u.telephone,
               u.telephone_secondaire,
               u.role, u.statut,
               COALESCE(s.numero_employe, c.numero_employe) AS numero_employe,
               s.departement AS superviseur_departement,
               co.departement AS conseillere_departement,
               c.service, s.taux_horaire, s.taux_kilometrique
          FROM utilisateurs u
          LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
          LEFT JOIN conseillere co ON co.utilisateur_id = u.id
          LEFT JOIN comptabilite c ON c.utilisateur_id = u.id
         WHERE u.role IN ('SUPERVISEUR', 'CONSEILLERE', 'COMPTABILITE')
         ORDER BY u.cree_le DESC, u.id DESC
      `);
      res.json({ employees: employees.map(normalizeEmployee) });
    } catch (error) { next(error); }
  });

  router.put("/:userId", async (req, res, next) => {
    const userId = positiveId(req.params.userId);
    const employee = validateEmployee(req.body);
    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      const [currentRows] = await connection.execute(
        "SELECT role FROM utilisateurs WHERE id = ? AND role IN ('SUPERVISEUR', 'CONSEILLERE', 'COMPTABILITE') FOR UPDATE",
        [userId]
      );
      if (!currentRows[0]) throw httpError("Employé introuvable.", 404);
      if (currentRows[0].role !== employee.role) throw httpError("Le rôle d’un compte existant ne peut pas être modifié.", 400);

      await connection.execute(
        "UPDATE utilisateurs SET nom = ?, prenom = ?, courriel = ?, telephone = ?, telephone_secondaire = ? WHERE id = ?",
        [employee.nom, employee.prenom, employee.courriel, employee.telephone, employee.telephone_secondaire, userId]
      );
      if (employee.role === "SUPERVISEUR") {
        await connection.execute(
          "UPDATE superviseurs SET numero_employe = ?, departement = ?, taux_horaire = ?, taux_kilometrique = ? WHERE utilisateur_id = ?",
          [employee.numero_employe, employee.departement, employee.taux_horaire, employee.taux_kilometrique, userId]
        );
      } else if (employee.role === "CONSEILLERE") {
        await connection.execute("UPDATE conseillere SET departement = ? WHERE utilisateur_id = ?", [employee.departement, userId]);
      } else {
        await connection.execute("UPDATE comptabilite SET numero_employe = ?, service = ? WHERE utilisateur_id = ?", [employee.numero_employe, employee.service, userId]);
      }
      await connection.commit();
      res.json({ message: "Employé modifié." });
    } catch (error) {
      if (connection) await connection.rollback();
      next(normalizeDatabaseError(error));
    } finally { connection?.release(); }
  });

  router.patch("/:userId/status", async (req, res, next) => {
    try {
      const userId = positiveId(req.params.userId);
      const status = String(req.body.status || "").toUpperCase();
      if (!new Set(["ACTIF", "INACTIF"]).has(status)) throw httpError("Statut employé invalide.", 400);
      const [result] = await db.execute(
        "UPDATE utilisateurs SET statut = ? WHERE id = ? AND role IN ('SUPERVISEUR', 'CONSEILLERE', 'COMPTABILITE')",
        [status, userId]
      );
      if (!result.affectedRows) throw httpError("Employé introuvable.", 404);
      res.json({ message: status === "ACTIF" ? "Employé réactivé." : "Employé archivé." });
    } catch (error) { next(normalizeDatabaseError(error)); }
  });

  return router;
}

function normalizeEmployee(row) {
  return {
    ...row,
    departement: row.superviseur_departement || row.conseillere_departement || "",
    taux_horaire: row.taux_horaire == null ? "" : String(row.taux_horaire),
    taux_kilometrique: row.taux_kilometrique == null ? "" : String(row.taux_kilometrique)
  };
}

function validateEmployee(body = {}) {
  const employee = {
    role: String(body.role || "").toUpperCase(), nom: String(body.nom || "").trim(),
    prenom: String(body.prenom || "").trim(), courriel: String(body.courriel || "").trim().toLowerCase(),
    telephone: String(body.telephone || "").trim() || null,
    telephone_secondaire: String(body.telephone_secondaire || "").trim() || null,
    numero_employe: String(body.numero_employe || "").trim() || null,
    departement: String(body.departement || "").trim() || null,
    service: String(body.service || "").trim() || null,
    taux_horaire: String(body.taux_horaire || "").trim(),
    taux_kilometrique: String(body.taux_kilometrique || "0.610").trim()
  };
  if (!EMPLOYEE_ROLES.has(employee.role) || !employee.nom || !employee.prenom || !employee.courriel) {
    throw httpError("Le rôle, le nom, le prénom et le courriel sont obligatoires.", 400);
  }
  if (["SUPERVISEUR", "COMPTABILITE"].includes(employee.role) && !employee.numero_employe) {
    throw httpError("Le numéro d’employé est obligatoire pour ce rôle.", 400);
  }
  if (employee.role === "SUPERVISEUR" && (!isPositive(employee.taux_horaire) || !isNonNegative(employee.taux_kilometrique))) {
    throw httpError("Les taux du superviseur sont invalides.", 400);
  }
  return employee;
}

function isPositive(value) { return /^\d+(\.\d{1,3})?$/.test(value) && Number(value) > 0; }
function isNonNegative(value) { return /^\d+(\.\d{1,3})?$/.test(value) && Number(value) >= 0; }
function positiveId(value) { const id = Number(value); if (!Number.isInteger(id) || id <= 0) throw httpError("Identifiant employé invalide.", 400); return id; }
function normalizeDatabaseError(error) { return error?.code === "ER_DUP_ENTRY" ? httpError("Ce courriel ou ce numéro d’employé est déjà utilisé.", 409) : error; }
function httpError(message, status) { const error = new Error(message); error.status = status; return error; }
