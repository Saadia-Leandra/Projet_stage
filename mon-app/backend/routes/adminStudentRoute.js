import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";

export default function adminStudentRoutes({ db }) {
  const router = Router();

  router.use(requireLogin);
  router.use(requireRole("CONSEILLERE", "DIRECTION"));

  router.get("/", async (_req, res, next) => {
    try {
      const [students] = await db.execute(`
        SELECT
          u.id AS userId,
          e.code_etudiant,
          u.nom,
          u.prenom,
          u.courriel,
          u.telephone,
          u.statut
        FROM utilisateurs u
        INNER JOIN etudiants e ON e.utilisateur_id = u.id
        WHERE u.role = 'ETUDIANT'
        ORDER BY u.cree_le DESC, u.id DESC
      `);

      res.json({ students });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:userId", async (req, res, next) => {
    const userId = positiveId(req.params.userId);
    const student = validateStudent(req.body);
    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [userResult] = await connection.execute(
        `UPDATE utilisateurs
         SET nom = ?, prenom = ?, courriel = ?, telephone = ?
         WHERE id = ? AND role = 'ETUDIANT'`,
        [
          student.nom,
          student.prenom,
          student.courriel,
          student.telephone,
          userId
        ]
      );

      if (userResult.affectedRows === 0) {
        throw httpError("Étudiant introuvable.", 404);
      }

      await connection.execute(
        `UPDATE etudiants SET code_etudiant = ? WHERE utilisateur_id = ?`,
        [student.code_etudiant, userId]
      );

      await connection.commit();
      res.json({ message: "Étudiant modifié." });
    } catch (error) {
      if (connection) await connection.rollback();
      next(normalizeDatabaseError(error));
    } finally {
      connection?.release();
    }
  });

  router.delete("/:userId", async (req, res, next) => {
    try {
      const userId = positiveId(req.params.userId);
      const [result] = await db.execute(
        "UPDATE utilisateurs SET statut = 'INACTIF' WHERE id = ? AND role = 'ETUDIANT'",
        [userId]
      );

      if (result.affectedRows === 0) {
        throw httpError("Étudiant introuvable.", 404);
      }

      res.json({ message: "Étudiant archivé." });
    } catch (error) {
      next(normalizeDatabaseError(error));
    }
  });

  router.patch("/:userId/status", async (req, res, next) => {
    try {
      const userId = positiveId(req.params.userId);
      const status = String(req.body.status || "").toUpperCase();

      if (!new Set(["ACTIF", "INACTIF"]).has(status)) {
        throw httpError("Statut étudiant invalide.", 400);
      }

      const [result] = await db.execute(
        "UPDATE utilisateurs SET statut = ? WHERE id = ? AND role = 'ETUDIANT'",
        [status, userId]
      );

      if (result.affectedRows === 0) {
        throw httpError("Étudiant introuvable.", 404);
      }

      res.json({
        message: status === "ACTIF" ? "Étudiant réactivé." : "Étudiant archivé."
      });
    } catch (error) {
      next(normalizeDatabaseError(error));
    }
  });

  return router;
}

function positiveId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw httpError("Identifiant étudiant invalide.", 400);
  }

  return id;
}

function validateStudent(body = {}) {
  const student = {
    code_etudiant: String(body.code_etudiant || "").trim(),
    nom: String(body.nom || "").trim(),
    prenom: String(body.prenom || "").trim(),
    courriel: String(body.courriel || "").trim().toLowerCase(),
    telephone: String(body.telephone || "").trim() || null
  };

  if (
    !student.code_etudiant ||
    !student.nom ||
    !student.prenom ||
    !student.courriel
  ) {
    throw httpError(
      "Le dossier, le nom, le prénom et le courriel sont obligatoires.",
      400
    );
  }

  return student;
}

function normalizeDatabaseError(error) {
  if (error?.code === "ER_DUP_ENTRY") {
    return httpError(
      "Ce courriel ou ce numéro de dossier est déjà utilisé.",
      409
    );
  }

  return error;
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
