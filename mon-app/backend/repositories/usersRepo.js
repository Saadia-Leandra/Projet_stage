export function createUsersRepo(db) {
  return {
    async findById(id) {
      const [rows] = await db.execute(
        `
          SELECT
            u.id,
            u.courriel AS email,
            u.mot_de_passe_hash AS passwordHash,
            u.prenom AS firstName,
            u.nom AS lastName,
            u.role,
            u.statut AS status,
            e.code_permanent AS codePermanent,
            e.code_etudiant AS studentCode,
            s.numero_employe AS employeeNumber,
            s.taux_kilometrique AS mileageRate
          FROM utilisateurs u
          LEFT JOIN etudiants e ON e.utilisateur_id = u.id
          LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
          WHERE u.id = ?
          LIMIT 1
        `,
        [id]
      );

      return rows[0] || null;
    },

    async findByIdentifier(identifier) {
      const normalizedIdentifier = String(identifier || "").trim().toLowerCase();

      const [rows] = await db.execute(
        `
          SELECT
            u.id,
            u.courriel AS email,
            u.mot_de_passe_hash AS passwordHash,
            u.prenom AS firstName,
            u.nom AS lastName,
            u.role,
            u.statut AS status,
            e.code_permanent AS codePermanent,
            e.code_etudiant AS studentCode,
            s.numero_employe AS employeeNumber,
            s.taux_kilometrique AS mileageRate
          FROM utilisateurs u
          LEFT JOIN etudiants e ON e.utilisateur_id = u.id
          LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
          WHERE
            LOWER(u.courriel) = ?
            OR LOWER(e.code_permanent) = ?
            OR LOWER(e.code_etudiant) = ?
            OR LOWER(s.numero_employe) = ?
          LIMIT 1
        `,
        [
          normalizedIdentifier,
          normalizedIdentifier,
          normalizedIdentifier,
          normalizedIdentifier
        ]
      );

      return rows[0] || null;
    }
  };
}
