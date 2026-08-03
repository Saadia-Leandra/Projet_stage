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
            AND u.statut = 'ACTIF'
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
              AND u.statut = 'ACTIF'
              AND e.code_etudiant = ?
              AND e.programme = ?
              AND e.groupe = ?
            ORDER BY ds.cree_le DESC
            LIMIT 1
          `,
          [
            supervisorUserId,
            chargeData.studentCode,
            chargeData.courseTitle,
            chargeData.courseCodeGroup
          ]
        );

        if (!studentRows[0]) {
          throw createError("L'etudiant, le cours et le groupe ne correspondent pas au superviseur.", 400);
        }

        const student = studentRows[0];
        const hourlyRate = Number(supervisorRows[0].hourlyRate);
        const comment = buildChargeComment(chargeData);

        const [existingCharges] = await connection.execute(
          `SELECT cps.id
             FROM charges_paie_supervision cps
             INNER JOIN etudiants_charge_paie ecp
               ON ecp.charge_paie_supervision_id = cps.id
            WHERE cps.superviseur_id = ? AND ecp.etudiant_id = ?
            LIMIT 1 FOR UPDATE`,
          [supervisorUserId, student.studentUserId]
        );
        if (existingCharges.length) {
          throw createError(
            "Une charge de paie de supervision existe déjà pour cet étudiant.",
            409
          );
        }

        try {
          await connection.execute(
            `INSERT INTO verrous_charge_paie_supervision (superviseur_id, etudiant_id)
             VALUES (?, ?)`,
            [supervisorUserId, student.studentUserId]
          );
        } catch (error) {
          if (error.code === "ER_DUP_ENTRY") {
            throw createError(
              "Une charge de paie de supervision existe déjà pour cet étudiant.",
              409
            );
          }
          throw error;
        }

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

      if (user.role === "DIRECTION") {
        where.push("cps.statut != 'CALCULE'");
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
            cps.motif_refus AS refusalReason,
            cps.resoumis_le AS resubmittedAt,
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

      return rows.map((row) => ({ ...row, ...parseChargeComment(row.comment) }));
    },

    async resubmitSupervisionCharge({ id, supervisorUserId, data }) {
      const chargeId = positiveId(id);
      const chargeData = validateChargeData(data);

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          `SELECT cps.id, ecp.etudiant_id AS studentUserId
           FROM charges_paie_supervision cps
           JOIN etudiants_charge_paie ecp ON ecp.charge_paie_supervision_id = cps.id
           WHERE cps.id = ? AND cps.superviseur_id = ? AND cps.statut = 'REJETE'
           LIMIT 1 FOR UPDATE`,
          [chargeId, supervisorUserId]
        );
        if (!rows.length) {
          throw createError("Charge refusée introuvable ou déjà resoumise.", 409);
        }

        const [studentRows] = await connection.execute(
          `SELECT e.utilisateur_id AS studentUserId, e.code_etudiant AS studentCode,
                  CONCAT(u.prenom, ' ', u.nom) AS studentName, ds.id AS stageFileId
             FROM etudiants e JOIN utilisateurs u ON u.id = e.utilisateur_id
             LEFT JOIN dossiers_stage ds ON ds.etudiant_id = e.utilisateur_id AND ds.superviseur_id = e.superviseur_id
            WHERE e.superviseur_id = ? AND u.statut = 'ACTIF' AND e.code_etudiant = ?
              AND e.programme = ? AND e.groupe = ? ORDER BY ds.cree_le DESC LIMIT 1`,
          [supervisorUserId, chargeData.studentCode, chargeData.courseTitle, chargeData.courseCodeGroup]
        );
        if (!studentRows[0]) throw createError("L'étudiant, le cours et le groupe ne correspondent pas au superviseur.", 400);
        const student = studentRows[0];
        if (Number(student.studentUserId) !== Number(rows[0].studentUserId)) {
          const [duplicate] = await connection.execute(
            `SELECT 1 FROM verrous_charge_paie_supervision WHERE superviseur_id = ? AND etudiant_id = ? LIMIT 1 FOR UPDATE`,
            [supervisorUserId, student.studentUserId]
          );
          if (duplicate.length) throw createError("Une charge de paie existe déjà pour cet étudiant.", 409);
          await connection.execute(`DELETE FROM verrous_charge_paie_supervision WHERE superviseur_id = ? AND etudiant_id = ?`, [supervisorUserId, rows[0].studentUserId]);
          await connection.execute(`INSERT INTO verrous_charge_paie_supervision (superviseur_id, etudiant_id) VALUES (?, ?)`, [supervisorUserId, student.studentUserId]);
        }
        await connection.execute(
          `UPDATE etudiants_charge_paie SET etudiant_id = ?, commentaire = ? WHERE charge_paie_supervision_id = ?`,
          [student.studentUserId, buildChargeComment(chargeData), chargeId]
        );
        await connection.execute(
          `UPDATE charges_paie_supervision SET
             statut = 'CALCULE',
             dossier_stage_id = ?, code_etudiant = ?, nom_etudiant = ?, motif_refus = NULL,
             resoumis_le = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [student.stageFileId || null, student.studentCode, student.studentName, chargeId]
        );
        await connection.commit();
        return { id: chargeId, status: "CALCULE" };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
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

    async getSupervisorPayrollReport({ supervisorId, user }) {
      if (user.role === "SUPERVISEUR" && String(user.id) !== String(supervisorId)) {
        throw createError("Acces refuse.", 403);
      }

      const [[supervisorRows], [charges], [trips]] = await Promise.all([
        db.execute(
          `
            SELECT
              u.id AS supervisorUserId,
              CONCAT(u.prenom, ' ', u.nom) AS supervisorName,
              u.courriel AS supervisorEmail,
              s.numero_employe AS employeeNumber
            FROM superviseurs s
            JOIN utilisateurs u ON u.id = s.utilisateur_id
            WHERE u.id = ?
            LIMIT 1
          `,
          [supervisorId]
        ),
        db.execute(
          `
            SELECT
              cps.cree_le AS createdAt,
              cps.dossier_stage_id AS stageFileId,
              cps.code_etudiant AS studentCode,
              cps.nom_etudiant AS studentName,
              cps.heures_supervision AS hours,
              cps.taux_horaire AS hourlyRate,
              cps.montant_total AS amount,
              cps.statut AS status,
              ecp.commentaire AS comment
            FROM charges_paie_supervision cps
            LEFT JOIN etudiants_charge_paie ecp
              ON ecp.charge_paie_supervision_id = cps.id
            WHERE cps.superviseur_id = ?
              AND cps.statut IN ('CALCULE', 'VALIDE', 'EXPORTE')
            ORDER BY cps.cree_le ASC, cps.id ASC
          `,
          [supervisorId]
        ),
        db.execute(
          `
            SELECT
              dk.date_deplacement AS tripDate,
              dk.distance_km AS distanceKm,
              dk.taux_kilometrique AS mileageRate,
              dk.montant_stationnement AS parkingAmount,
              dk.montant_remboursement AS amount,
              dk.statut AS status
            FROM deplacements_kilometrage dk
            WHERE dk.superviseur_id = ?
              AND dk.statut IN ('CALCULE', 'VALIDE', 'EXPORTE')
            ORDER BY dk.date_deplacement ASC, dk.id ASC
          `,
          [supervisorId]
        )
      ]);

      if (!supervisorRows[0]) {
        throw createError("Superviseur introuvable.", 404);
      }

      return { supervisor: supervisorRows[0], charges, trips };
    },

    async updateSupervisionChargeStatus({ id, status, refusalReason }) {
      const allowedStatuses = new Set(["CALCULE", "VALIDE", "REJETE", "EXPORTE"]);

      if (!allowedStatuses.has(status)) {
        const error = new Error("Statut de charge de paie invalide.");
        error.status = 400;
        throw error;
      }

      const reason = validateRefusalReason(status, refusalReason);

      const [result] = await db.execute(
        `
          UPDATE charges_paie_supervision
          SET statut = ?, motif_refus = ?
          WHERE id = ?
        `,
        [status, reason, id]
      );

      if (!result.affectedRows) {
        const error = new Error("Charge de paie introuvable.");
        error.status = 404;
        throw error;
      }
    }
  };
}

function validateRefusalReason(status, value) {
  if (status !== "REJETE") return null;
  const reason = String(value || "").trim();
  if (reason.length < 10 || reason.length > 2000) {
    const error = new Error("Le motif du refus doit contenir entre 10 et 2000 caractères.");
    error.status = 400;
    throw error;
  }
  return reason;
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

  if (!chargeData.courseTitle || !chargeData.courseCodeGroup) {
    throw createError("Le cours et le groupe sont obligatoires.", 400);
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

function parseChargeComment(value) {
  const result = { courseTitle: "", courseCodeGroup: "", session: "", userComment: "" };
  for (const part of String(value || "").split(" | ")) {
    if (part.startsWith("Cours: ")) result.courseTitle = part.slice(7);
    else if (part.startsWith("Code/groupe: ")) result.courseCodeGroup = part.slice(13);
    else if (part.startsWith("Session: ")) result.session = part.slice(9);
    else if (part.startsWith("Commentaire: ")) result.userComment = part.slice(13);
  }
  return result;
}

function positiveId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw createError("Identifiant de charge invalide.", 400);
  return id;
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
