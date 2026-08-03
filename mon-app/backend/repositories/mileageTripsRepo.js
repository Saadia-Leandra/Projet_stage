export function createMileageTripsRepo(db) {
  return {
    async getSupervisorRate(supervisorUserId) {
      const [rows] = await db.execute(
        `
          SELECT COALESCE(taux_kilometrique, 0.610) AS ratePerKm
          FROM superviseurs
          WHERE utilisateur_id = ?
          LIMIT 1
        `,
        [supervisorUserId]
      );

      if (!rows[0]) {
        const error = new Error("Profil superviseur introuvable.");
        error.status = 400;
        throw error;
      }

      return Number(rows[0].ratePerKm);
    },

    async listSupervisorStudents(supervisorUserId) {
      const [rows] = await db.execute(
        `
          SELECT
            e.utilisateur_id AS id,
            e.code_etudiant AS studentCode,
            CONCAT(u.prenom, ' ', u.nom) AS studentName,
            e.programme AS program,
            e.groupe AS groupe,
            ds.id AS folderId,
            ds.statut AS folderStatus,
            d.id AS requestId,
            d.statut AS requestStatus,
            ent.id AS companyId,
            ent.nom AS companyName,
            ent.adresse AS companyAddress,
            ent.ville AS companyCity,
            ent.code_postal AS companyPostalCode
          FROM etudiants e
          JOIN utilisateurs u ON u.id = e.utilisateur_id
          LEFT JOIN dossiers_stage ds ON ds.etudiant_id = e.utilisateur_id
          LEFT JOIN (
            SELECT dossier_stage_id, MAX(id) AS requestId
            FROM demandes_stage
            GROUP BY dossier_stage_id
          ) latest ON latest.dossier_stage_id = ds.id
          LEFT JOIN demandes_stage d ON d.id = latest.requestId
          LEFT JOIN entreprises ent ON ent.id = d.entreprise_id
          WHERE e.superviseur_id = ?
            AND u.statut = 'ACTIF'
          ORDER BY u.nom, u.prenom
        `,
        [supervisorUserId]
      );

      return rows;
    },

    async assertActiveStudents(supervisorUserId, studentIds) {
      const ids = [...new Set((studentIds || []).map(Number).filter(Number.isInteger))];

      if (!ids.length) {
        const error = new Error("Un étudiant actif est obligatoire pour calculer le kilométrage.");
        error.status = 400;
        throw error;
      }

      const placeholders = ids.map(() => "?").join(", ");
      const [rows] = await db.execute(
        `SELECT COUNT(*) AS activeCount
         FROM etudiants e
         JOIN utilisateurs u ON u.id = e.utilisateur_id
         WHERE e.superviseur_id = ?
           AND u.statut = 'ACTIF'
           AND e.utilisateur_id IN (${placeholders})`,
        [supervisorUserId, ...ids]
      );

      if (Number(rows[0]?.activeCount) !== ids.length) {
        const error = new Error("Le kilométrage ne peut pas être calculé pour un étudiant archivé ou non assigné.");
        error.status = 409;
        throw error;
      }
    },

    async assertNoDuplicateTripStudents(supervisorUserId, tripDate, studentIds) {
      const ids = [...new Set((studentIds || []).map(Number).filter(Number.isInteger))];
      if (!ids.length || !tripDate) return;
      const placeholders = ids.map(() => "?").join(", ");
      const [rows] = await db.execute(
        `SELECT etudiant_id
           FROM etudiants_deplacement_kilometrage
          WHERE superviseur_id = ? AND date_deplacement = ?
            AND etudiant_id IN (${placeholders})
          LIMIT 1`,
        [supervisorUserId, tripDate, ...ids]
      );
      if (rows.length) {
        const error = new Error(
          "Une charge de kilométrage existe déjà pour cet étudiant à cette date."
        );
        error.status = 409;
        throw error;
      }
    },

    async create(data) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const campusId = await findCampusId(connection, data.campus);
        const selectedStudentIds = data.destinations
          .map((destination) => Number(destination.studentId))
          .filter((id) => Number.isInteger(id) && id > 0);
        const studentIds = [...new Set(selectedStudentIds)];

        if (!studentIds.length) {
          const error = new Error("Au moins un étudiant est requis pour le kilométrage.");
          error.status = 400;
          throw error;
        }
        if (studentIds.length !== selectedStudentIds.length) {
          const error = new Error("Un étudiant ne peut apparaître qu’une seule fois dans un déplacement.");
          error.status = 400;
          throw error;
        }

        const studentMarks = studentIds.map(() => "?").join(", ");
        const [duplicates] = await connection.execute(
          `SELECT etudiant_id
             FROM etudiants_deplacement_kilometrage
            WHERE superviseur_id = ? AND date_deplacement = ?
              AND etudiant_id IN (${studentMarks})
            LIMIT 1 FOR UPDATE`,
          [data.supervisorUserId, data.tripDate, ...studentIds]
        );
        if (duplicates.length) {
          const error = new Error(
            "Une charge de kilométrage existe déjà pour cet étudiant à cette date. Choisissez une autre date."
          );
          error.status = 409;
          throw error;
        }

        const [result] = await connection.execute(
          `
            INSERT INTO deplacements_kilometrage (
              superviseur_id,
              campus_id,
              programme,
              groupe,
              date_deplacement,
              type_trajet,
              fournisseur_calcul,
              distance_km,
              duree_minutes,
              taux_kilometrique,
              montant_stationnement,
              url_carte,
              instantane_itineraire,
              trace_gps,
              depart_reel_le,
              arrivee_reelle_le,
              preuve_stationnement_nom,
              preuve_stationnement_type,
              preuve_stationnement_fichier,
              statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CALCULE')
          `,
          [
            data.supervisorUserId,
            campusId,
            nullable(data.program),
            nullable(data.group),
            data.tripDate,
            data.tripType,
            data.provider,
            data.distanceKm,
            data.durationMinutes,
            data.ratePerKm,
            data.parkingAmount,
            nullable(data.mapUrl),
            data.routeSnapshot ? JSON.stringify(data.routeSnapshot) : null,
            data.gpsTrace?.length ? JSON.stringify(data.gpsTrace) : null,
            toSqlDateTime(data.startedAt, "heure de départ"),
            toSqlDateTime(data.endedAt, "heure d’arrivée"),
            nullable(data.parkingReceipt?.name),
            nullable(data.parkingReceipt?.type),
            nullable(data.parkingReceipt?.storedName)
          ]
        );

        const tripId = result.insertId;

        for (const studentId of studentIds) {
          await connection.execute(
            `INSERT INTO etudiants_deplacement_kilometrage
              (deplacement_kilometrage_id, superviseur_id, etudiant_id, date_deplacement)
             VALUES (?, ?, ?, ?)`,
            [tripId, data.supervisorUserId, studentId, data.tripDate]
          );
        }

        for (const [index, destination] of data.destinations.entries()) {
          await connection.execute(
            `
              INSERT INTO destinations_deplacement (
                deplacement_kilometrage_id,
                entreprise_id,
                ordre_destination,
                libelle_destination,
                adresse_destination
              ) VALUES (?, ?, ?, ?, ?)
            `,
            [
              tripId,
              destination.companyId || null,
              index + 1,
              destination.label,
              destination.address
            ]
          );
        }

        await connection.commit();

        return { id: tripId };
      } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
          error.message = "Une charge de kilométrage existe déjà pour cet étudiant à cette date.";
          error.status = 409;
        }
        throw error;
      } finally {
        connection.release();
      }
    },

    async list(supervisorUserId = null, historyOnly = false) {
      const params = [];
      const filters = [];

      if (supervisorUserId) {
        filters.push("dk.superviseur_id = ?");
        params.push(supervisorUserId);
      }

      if (historyOnly) filters.push("dk.statut != 'CALCULE'");

      const [rows] = await db.execute(
        `
          SELECT
            dk.id,
            dk.superviseur_id AS supervisorUserId,
            CONCAT(u.prenom, ' ', u.nom) AS supervisorName,
            ca.code AS campusCode,
            ca.nom AS campusName,
            dk.programme AS program,
            dk.groupe AS groupe,
            dk.date_deplacement AS tripDate,
            dk.type_trajet AS tripType,
            dk.fournisseur_calcul AS provider,
            dk.distance_km AS distanceKm,
            dk.duree_minutes AS durationMinutes,
            dk.taux_kilometrique AS ratePerKm,
            dk.montant_stationnement AS parkingAmount,
            dk.montant_remboursement AS reimbursementAmount,
            dk.url_carte AS mapUrl,
            dk.instantane_itineraire AS routeSnapshot,
            dk.trace_gps AS gpsTrace,
            dk.depart_reel_le AS startedAt,
            dk.arrivee_reelle_le AS endedAt,
            dk.preuve_stationnement_nom AS parkingReceiptName,
            dk.preuve_stationnement_type AS parkingReceiptType,
            (dk.preuve_stationnement_fichier IS NOT NULL) AS hasParkingReceipt,
            dk.statut AS status,
            dk.motif_refus AS refusalReason,
            dk.calcule_le AS calculatedAt
          FROM deplacements_kilometrage dk
          JOIN utilisateurs u ON u.id = dk.superviseur_id
          JOIN campus ca ON ca.id = dk.campus_id
          ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
          ORDER BY dk.calcule_le DESC
        `,
        params
      );

      const enrichedRows = [];
      for (const row of rows) {
        const [destinations] = await db.execute(
          `SELECT entreprise_id AS companyId, libelle_destination AS label, adresse_destination AS address
             FROM destinations_deplacement WHERE deplacement_kilometrage_id = ? ORDER BY ordre_destination`, [row.id]
        );
        const [students] = await db.execute(
          `SELECT etudiant_id AS studentId FROM etudiants_deplacement_kilometrage
            WHERE deplacement_kilometrage_id = ? ORDER BY id`, [row.id]
        );
        enrichedRows.push({
          ...row,
          destinations: destinations.map((destination, index) => ({ ...destination, studentId: students[index]?.studentId || null })),
          routeSnapshot: parseJson(row.routeSnapshot),
          gpsTrace: typeof row.gpsTrace === "string" ? JSON.parse(row.gpsTrace) : row.gpsTrace
        });
      }
      return enrichedRows;
    },

    async updateRejected(data) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [owned] = await connection.execute(
          `SELECT id, preuve_stationnement_fichier AS existingReceipt FROM deplacements_kilometrage
            WHERE id = ? AND superviseur_id = ? AND statut = 'REJETE' LIMIT 1 FOR UPDATE`,
          [data.id, data.supervisorUserId]
        );
        if (!owned.length) throw createError("Déplacement refusé introuvable ou déjà resoumis.", 409);
        if (Number(data.parkingAmount) > 0 && !data.parkingReceipt && !owned[0].existingReceipt) {
          throw createError("Le ticket de stationnement est obligatoire lorsqu’un montant est indiqué.", 400);
        }
        const studentIds = [...new Set(data.destinations.map((item) => Number(item.studentId)).filter(Number.isInteger))];
        if (!studentIds.length || studentIds.length !== data.destinations.length) throw createError("Chaque destination doit correspondre à un étudiant différent.", 400);
        await connection.execute(`DELETE FROM etudiants_deplacement_kilometrage WHERE deplacement_kilometrage_id = ?`, [data.id]);
        const marks = studentIds.map(() => "?").join(", ");
        const [duplicates] = await connection.execute(
          `SELECT 1 FROM etudiants_deplacement_kilometrage WHERE superviseur_id = ? AND date_deplacement = ? AND etudiant_id IN (${marks}) LIMIT 1 FOR UPDATE`,
          [data.supervisorUserId, data.tripDate, ...studentIds]
        );
        if (duplicates.length) throw createError("Une charge de kilométrage existe déjà pour cet étudiant à cette date.", 409);
        const campusId = await findCampusId(connection, data.campus);
        await connection.execute(
          `UPDATE deplacements_kilometrage SET campus_id=?, programme=?, groupe=?, date_deplacement=?, type_trajet=?,
             fournisseur_calcul=?, distance_km=?, duree_minutes=?, taux_kilometrique=?, montant_stationnement=?,
             url_carte=?, instantane_itineraire=?, trace_gps=?, depart_reel_le=?, arrivee_reelle_le=?,
             preuve_stationnement_nom=COALESCE(?, preuve_stationnement_nom), preuve_stationnement_type=COALESCE(?, preuve_stationnement_type),
             preuve_stationnement_fichier=COALESCE(?, preuve_stationnement_fichier), statut='CALCULE', motif_refus=NULL, calcule_le=CURRENT_TIMESTAMP
           WHERE id=?`,
          [campusId, nullable(data.program), nullable(data.group), data.tripDate, data.tripType, data.provider,
            data.distanceKm, data.durationMinutes, data.ratePerKm, data.parkingAmount, nullable(data.mapUrl),
            JSON.stringify(data.routeSnapshot), data.gpsTrace?.length ? JSON.stringify(data.gpsTrace) : null,
            toSqlDateTime(data.startedAt, "heure de départ"), toSqlDateTime(data.endedAt, "heure d’arrivée"),
            nullable(data.parkingReceipt?.name), nullable(data.parkingReceipt?.type), nullable(data.parkingReceipt?.storedName), data.id]
        );
        await connection.execute(`DELETE FROM destinations_deplacement WHERE deplacement_kilometrage_id = ?`, [data.id]);
        for (const [index, destination] of data.destinations.entries()) {
          await connection.execute(`INSERT INTO etudiants_deplacement_kilometrage (deplacement_kilometrage_id, superviseur_id, etudiant_id, date_deplacement) VALUES (?, ?, ?, ?)`, [data.id, data.supervisorUserId, destination.studentId, data.tripDate]);
          await connection.execute(`INSERT INTO destinations_deplacement (deplacement_kilometrage_id, entreprise_id, ordre_destination, libelle_destination, adresse_destination) VALUES (?, ?, ?, ?, ?)`, [data.id, destination.companyId || null, index + 1, destination.label, destination.address]);
        }
        await connection.commit();
        return { id: data.id };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally { connection.release(); }
    },

    async findReceipt(id, user) {
      const ownerSql = user.role === "SUPERVISEUR" ? " AND superviseur_id = ?" : "";
      const params = user.role === "SUPERVISEUR" ? [id, user.id] : [id];
      const [receiptRows] = await db.execute("SELECT preuve_stationnement_nom AS name, preuve_stationnement_type AS type, preuve_stationnement_fichier AS storedName FROM deplacements_kilometrage WHERE id = ?" + ownerSql + " LIMIT 1", params);
      return receiptRows[0] || null;
    },
    async findRouteProof(id, user) {
      const ownerSql = user.role === "SUPERVISEUR" ? " AND superviseur_id = ?" : "";
      const params = user.role === "SUPERVISEUR" ? [id, user.id] : [id];
      const [rows] = await db.execute("SELECT instantane_itineraire AS snapshot FROM deplacements_kilometrage WHERE id = ?" + ownerSql + " LIMIT 1", params);
      return parseJson(rows[0]?.snapshot)?.proofImageStoredName || null;
    },
    async updateStatus(id, status, refusalReason) {
      if (!["VALIDE", "REJETE"].includes(status)) {
        const error = new Error("Statut de deplacement invalide.");
        error.status = 400;
        throw error;
      }
      const reason = validateRefusalReason(status, refusalReason);
      const [result] = await db.execute("UPDATE deplacements_kilometrage SET statut = ?, motif_refus = ? WHERE id = ? AND statut != 'EXPORTE'", [status, reason, id]);
      if (!result.affectedRows) {
        const error = new Error("Deplacement introuvable ou deja exporte.");
        error.status = 404;
        throw error;
      }
    }
  };
}

async function findCampusId(connection, campus) {
  const campusValue = typeof campus === "object" ? campus?.code || campus?.id || campus?.name : campus;
  const [rows] = await connection.execute(
    `
      SELECT id
      FROM campus
      WHERE id = ? OR code = ? OR nom = ?
      LIMIT 1
    `,
    [campusValue || 0, campusValue || "", campusValue || ""]
  );

  if (!rows[0]) {
    const error = new Error("Campus introuvable pour le deplacement.");
    error.status = 400;
    throw error;
  }

  return rows[0].id;
}

function nullable(value) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toSqlDateTime(value, label) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error(`L’${label} est invalide.`);
    error.status = 400;
    throw error;
  }
  return date.toISOString().slice(0, 19).replace("T", " ");
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

function parseJson(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}



