import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";

export default function adminStudentRoutes({ db }) {
  const router = Router();

  router.use(requireLogin);
  router.use(requireRole("CONSEILLERE"));

  router.get("/", async (_req, res, next) => {
    try {
      const [students] = await db.execute(`
        SELECT
          u.id AS userId,
          e.*,
          u.nom,
          u.prenom,
          u.courriel,
          u.telephone,
          u.telephone_secondaire,
          u.statut
        FROM utilisateurs u
        INNER JOIN etudiants e ON e.utilisateur_id = u.id
        WHERE u.role = 'ETUDIANT'
        ORDER BY u.cree_le DESC, u.id DESC
      `);

      const [supervisors] = await db.execute(`
        SELECT u.id AS userId, u.prenom, u.nom, s.numero_employe
        FROM utilisateurs u
        INNER JOIN superviseurs s ON s.utilisateur_id = u.id
        WHERE u.role = 'SUPERVISEUR' AND u.statut = 'ACTIF'
        ORDER BY u.nom, u.prenom
      `);
      res.json({ students, supervisors });
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
         SET nom = ?, prenom = ?, courriel = ?, telephone = ?, telephone_secondaire = ?
         WHERE id = ? AND role = 'ETUDIANT'`,
        [
          student.nom,
          student.prenom,
          student.courriel,
          student.telephone,
          student.telephone_secondaire,
          userId
        ]
      );

      if (userResult.affectedRows === 0) {
        throw httpError("Étudiant introuvable.", 404);
      }

      await connection.execute(
        `UPDATE etudiants SET
          superviseur_id = ?, code_etudiant = ?, programme = ?, cohorte = ?,
          adresse = ?, ville = ?, province = ?, code_postal = ?, code_permanent = ?,
          groupe = ?, expiration_caq = ?, expiration_permis_etudes = ?,
          expiration_assurance = ?, session = ?, numero_cours = ?, titre_cours = ?,
          discipline = ?, horaire = ?, ponderation = ?, date_debut_groupe = ?,
          date_fin_groupe = ?
         WHERE utilisateur_id = ?`,
        [student.superviseur_id, student.code_etudiant, student.programme,
          student.cohorte, student.adresse, student.ville, student.province,
          student.code_postal, student.code_permanent, student.groupe,
          student.expiration_caq, student.expiration_permis_etudes,
          student.expiration_assurance, student.session, student.numero_cours,
          student.titre_cours, student.discipline, student.horaire,
          student.ponderation, student.date_debut_groupe, student.date_fin_groupe,
          userId]
      );

      await connection.execute(
        `UPDATE dossiers_stage SET superviseur_id = ?
         WHERE etudiant_id = ? AND statut <> 'DOSSIER_COMPLET'`,
        [student.superviseur_id, userId]
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
    telephone: nullable(body.telephone),
    telephone_secondaire: nullable(body.telephone_secondaire),
    superviseur_id: optionalPositiveId(body.superviseur_id),
    programme: String(body.programme || "").trim(),
    cohorte: nullable(body.cohorte),
    adresse: nullable(body.adresse),
    ville: nullable(body.ville),
    province: nullable(body.province),
    code_postal: nullable(body.code_postal),
    code_permanent: nullable(body.code_permanent),
    groupe: nullable(body.groupe),
    expiration_caq: nullable(body.expiration_caq),
    expiration_permis_etudes: nullable(body.expiration_permis_etudes),
    expiration_assurance: nullable(body.expiration_assurance),
    session: nullable(body.session),
    numero_cours: nullable(body.numero_cours),
    titre_cours: nullable(body.titre_cours),
    discipline: nullable(body.discipline),
    horaire: nullable(body.horaire),
    ponderation: nullable(body.ponderation),
    date_debut_groupe: nullable(body.date_debut_groupe),
    date_fin_groupe: nullable(body.date_fin_groupe)
  };

  if (
    !student.code_etudiant ||
    !student.nom ||
    !student.prenom ||
    !student.courriel ||
    !student.programme
  ) {
    throw httpError(
      "Le dossier, le nom, le prénom et le courriel sont obligatoires.",
      400
    );
  }

  return student;
}

function nullable(value) {
  return String(value || "").trim() || null;
}

function optionalPositiveId(value) {
  if (value === null || value === undefined || value === "") return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw httpError("Superviseur invalide.", 400);
  }
  return id;
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
