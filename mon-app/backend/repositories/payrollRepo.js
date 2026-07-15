export function createPayrollRepo(db) {
  const FIXED_SUPERVISION_HOURS = 4;

  return {
    async getSupervisorPayrollSettings(supervisorUserId) {
      const [supervisorRows] = await db.execute(
        `
          SELECT
            s.taux_horaire AS hourlyRate,
            s.numero_employe AS employeeNumber,
            CONCAT(u.prenom, ' ', u.nom) AS supervisorName
          FROM superviseurs s
          JOIN utilisateurs u ON u.id = s.utilisateur_id
          WHERE s.utilisateur_id = ?
          LIMIT 1
        `,
        [supervisorUserId]
      );

      if (!supervisorRows[0]) {
        const error = new Error("Profil superviseur introuvable.");
        error.status = 400;
        throw error;
      }

      const [studentRows] = await db.execute(
        `
          SELECT
            e.utilisateur_id AS studentUserId,
            e.code_etudiant AS studentCode,
            CONCAT(u.prenom, ' ', u.nom) AS studentName,
            e.programme AS program,
            e.groupe AS groupName,
            ds.id AS stageFileId
          FROM etudiants e
          JOIN utilisateurs u ON u.id = e.utilisateur_id
          LEFT JOIN dossiers_stage ds
            ON ds.etudiant_id = e.utilisateur_id
            AND ds.superviseur_id = e.superviseur_id
          WHERE e.superviseur_id = ?
          ORDER BY studentName ASC
        `,
        [supervisorUserId]
      );

      return {
        hourlyRate: Number(supervisorRows[0].hourlyRate),
        employeeNumber: supervisorRows[0].employeeNumber,
        supervisorName: supervisorRows[0].supervisorName,
        students: studentRows
      };
    },

    async createSupervisionCharge({ supervisorUserId, data }) {
      const chargeData = validateChargeData(data);
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [supervisorRows] = await connection.execute(
          `
            SELECT taux_horaire AS hourlyRate
            FROM superviseurs
            WHERE utilisateur_id = ?
            LIMIT 1
          `,
          [supervisorUserId]
        );

        if (!supervisorRows[0]) {
          throw createError("Profil superviseur introuvable.", 400);
        }

        const [studentRows] = await connection.execute(
          `
            SELECT
              e.utilisateur_id AS studentUserId,
              e.code_etudiant AS studentCode,
              CONCAT(u.prenom, ' ', u.nom) AS studentName,
              ds.id AS stageFileId
            FROM etudiants e
            JOIN utilisateurs u ON u.id = e.utilisateur_id
            LEFT JOIN dossiers_stage ds
              ON ds.etudiant_id = e.utilisateur_id
              AND ds.superviseur_id = e.superviseur_id
            WHERE e.superviseur_id = ?
              AND e.code_etudiant = ?
            ORDER BY ds.cree_le DESC
            LIMIT 1
          `,
          [supervisorUserId, chargeData.studentCode]
        );

        if (!studentRows[0]) {
          throw createError("Etudiant introuvable pour ce superviseur.", 400);
        }

        const student = studentRows[0];
        const hourlyRate = Number(supervisorRows[0].hourlyRate);
        const comment = buildChargeComment(chargeData);

        const [result] = await connection.execute(
          `
            INSERT INTO charges_paie_supervision (
              superviseur_id,
              dossier_stage_id,
              code_etudiant,
              nom_etudiant,
              heures_supervision,
              taux_horaire,
              statut
            ) VALUES (?, ?, ?, ?, ?, ?, 'CALCULE')
          `,
          [
            supervisorUserId,
            student.stageFileId || null,
            student.studentCode,
            student.studentName,
            FIXED_SUPERVISION_HOURS,
            hourlyRate
          ]
        );

        await connection.execute(
          `
            INSERT INTO etudiants_charge_paie (
              charge_paie_supervision_id,
              etudiant_id,
              commentaire
            ) VALUES (?, ?, ?)
          `,
          [
            result.insertId,
            student.studentUserId,
            comment
          ]
        );

        await connection.commit();

        return {
          id: result.insertId,
          studentCode: student.studentCode,
          studentName: student.studentName,
          supervisionHours: FIXED_SUPERVISION_HOURS,
          hourlyRate,
          totalAmount: FIXED_SUPERVISION_HOURS * hourlyRate,
          status: "CALCULE"
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async listSupervisionCharges({ user }) {
      const params = [];
      const where = [];

      if (user.role === "SUPERVISEUR") {
        where.push("cps.superviseur_id = ?");
        params.push(user.id);
      }

      const [rows] = await db.execute(
        `
          SELECT
            cps.id,
            cps.superviseur_id AS supervisorUserId,
            CONCAT(su.prenom, ' ', su.nom) AS supervisorName,
            su.courriel AS supervisorEmail,
            s.numero_employe AS employeeNumber,
            cps.dossier_stage_id AS stageFileId,
            cps.code_etudiant AS studentCode,
            cps.nom_etudiant AS studentName,
            cps.heures_supervision AS supervisionHours,
            cps.taux_horaire AS hourlyRate,
            cps.montant_total AS totalAmount,
            cps.verrouille AS locked,
            cps.statut AS status,
            cps.cree_le AS createdAt,
            ecp.commentaire AS comment
          FROM charges_paie_supervision cps
          JOIN utilisateurs su ON su.id = cps.superviseur_id
          JOIN superviseurs s ON s.utilisateur_id = cps.superviseur_id
          LEFT JOIN etudiants_charge_paie ecp ON ecp.charge_paie_supervision_id = cps.id
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY cps.cree_le DESC, cps.id DESC
        `,
        params
      );

      return rows;
    },

    async listSupervisorTotals({ user }) {
      const params = [];
      const where = [];

      if (user.role === "SUPERVISEUR") {
        where.push("u.id = ?");
        params.push(user.id);
      }

      const [rows] = await db.execute(
        `
          SELECT
            u.id AS supervisorUserId,
            CONCAT(u.prenom, ' ', u.nom) AS supervisorName,
            u.courriel AS supervisorEmail,
            s.numero_employe AS employeeNumber,
            COALESCE(supervision.totalSupervisionAmount, 0) AS supervisionAmount,
            COALESCE(supervision.supervisionHours, 0) AS supervisionHours,
            COALESCE(supervision.studentCount, 0) AS studentCount,
            COALESCE(mileage.mileageAmount, 0) AS mileageAmount,
            COALESCE(mileage.distanceKm, 0) AS distanceKm,
            COALESCE(mileage.tripCount, 0) AS tripCount,
            COALESCE(supervision.totalSupervisionAmount, 0) + COALESCE(mileage.mileageAmount, 0) AS totalAmount
          FROM superviseurs s
          JOIN utilisateurs u ON u.id = s.utilisateur_id
          LEFT JOIN (
            SELECT
              superviseur_id,
              SUM(montant_total) AS totalSupervisionAmount,
              SUM(heures_supervision) AS supervisionHours,
              COUNT(DISTINCT code_etudiant) AS studentCount
            FROM charges_paie_supervision
            WHERE statut IN ('CALCULE', 'VALIDE', 'EXPORTE')
            GROUP BY superviseur_id
          ) supervision ON supervision.superviseur_id = s.utilisateur_id
          LEFT JOIN (
            SELECT
              superviseur_id,
              SUM(montant_remboursement) AS mileageAmount,
              SUM(distance_km) AS distanceKm,
              COUNT(*) AS tripCount
            FROM deplacements_kilometrage
            WHERE statut IN ('CALCULE', 'VALIDE', 'EXPORTE')
            GROUP BY superviseur_id
          ) mileage ON mileage.superviseur_id = s.utilisateur_id
          ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
          ORDER BY totalAmount DESC, supervisorName ASC
        `,
        params
      );

      return rows;
    },

    async updateSupervisionChargeStatus({ id, status }) {
      const allowedStatuses = new Set(["CALCULE", "VALIDE", "REJETE", "EXPORTE"]);

      if (!allowedStatuses.has(status)) {
        const error = new Error("Statut de charge de paie invalide.");
        error.status = 400;
        throw error;
      }

      const [result] = await db.execute(
        `
          UPDATE charges_paie_supervision
          SET statut = ?
          WHERE id = ?
        `,
        [status, id]
      );

      if (!result.affectedRows) {
        const error = new Error("Charge de paie introuvable.");
        error.status = 404;
        throw error;
      }
    }
  };
}

function validateChargeData(data = {}) {
  const chargeData = {
    studentCode: clean(data.studentCode),
    courseTitle: optional(data.courseTitle),
    courseCodeGroup: optional(data.courseCodeGroup),
    session: optional(data.session),
    comment: optional(data.comment)
  };

  if (!chargeData.studentCode) {
    throw createError("L'etudiant est obligatoire.", 400);
  }

  return chargeData;
}

function buildChargeComment(data) {
  const lines = [
    data.courseTitle ? `Cours: ${data.courseTitle}` : null,
    data.courseCodeGroup ? `Code/groupe: ${data.courseCodeGroup}` : null,
    data.session ? `Session: ${data.session}` : null,
    data.comment ? `Commentaire: ${data.comment}` : null
  ].filter(Boolean);

  return lines.join(" | ") || null;
}

function clean(value) {
  return String(value ?? "").trim();
}

function optional(value) {
  const cleanedValue = clean(value);
  return cleanedValue || null;
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
