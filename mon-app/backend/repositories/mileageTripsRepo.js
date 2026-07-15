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
              statut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CALCULE')
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
            nullable(data.mapUrl)
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
            dk.statut AS status,
            dk.calcule_le AS calculatedAt
          FROM deplacements_kilometrage dk
          JOIN utilisateurs u ON u.id = dk.superviseur_id
          JOIN campus ca ON ca.id = dk.campus_id
          ${supervisorFilter}
          ORDER BY dk.calcule_le DESC
        `,
        params
      );

      return rows;
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
