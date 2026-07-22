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
          ORDER BY u.nom, u.prenom
        `,
        [supervisorUserId]
      );

      return rows;
    },

    async create(data) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const campusId = await findCampusId(connection, data.campus);
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
            data.startedAt || null,
            data.endedAt || null,
            nullable(data.parkingReceipt?.name),
            nullable(data.parkingReceipt?.type),
            nullable(data.parkingReceipt?.storedName)
          ]
        );

        const tripId = result.insertId;

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
        throw error;
      } finally {
        connection.release();
      }
    },

    async list(supervisorUserId = null) {
      const params = [];
      let supervisorFilter = "";

      if (supervisorUserId) {
        supervisorFilter = "WHERE dk.superviseur_id = ?";
        params.push(supervisorUserId);
      }

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
          ${supervisorFilter}
          ORDER BY dk.calcule_le DESC
        `,
        params
      );

      return rows.map((row) => ({
        ...row,
        routeSnapshot: parseJson(row.routeSnapshot),
        gpsTrace: typeof row.gpsTrace === "string" ? JSON.parse(row.gpsTrace) : row.gpsTrace
      }));
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



