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
    },

    async findByEmail(email) {
      const [rows] = await db.execute(
        `
          SELECT id, courriel AS email
          FROM utilisateurs
          WHERE LOWER(courriel) = ?
          LIMIT 1
        `,
        [String(email || "").trim().toLowerCase()]
      );

      return rows[0] || null;
    },

    async createPasswordResetToken(userId, tokenHash, expiresAt) {
      await db.execute(
        `
          UPDATE password_reset_tokens
          SET utilise_le = CURRENT_TIMESTAMP
          WHERE utilisateur_id = ? AND utilise_le IS NULL
        `,
        [userId]
      );

      await db.execute(
        `
          INSERT INTO password_reset_tokens (utilisateur_id, token_hash, expire_le)
          VALUES (?, ?, ?)
        `,
        [userId, tokenHash, expiresAt]
      );
    },

    async consumePasswordResetToken(tokenHash, passwordHash) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
          `
            SELECT id, utilisateur_id AS userId
            FROM password_reset_tokens
            WHERE
              token_hash = ?
              AND utilise_le IS NULL
              AND expire_le > CURRENT_TIMESTAMP
            LIMIT 1
            FOR UPDATE
          `,
          [tokenHash]
        );

        const resetToken = rows[0];

        if (!resetToken) {
          await connection.rollback();
          return false;
        }

        await connection.execute(
          "UPDATE utilisateurs SET mot_de_passe_hash = ? WHERE id = ?",
          [passwordHash, resetToken.userId]
        );
        await connection.execute(
          `
            UPDATE password_reset_tokens
            SET utilise_le = CURRENT_TIMESTAMP
            WHERE utilisateur_id = ? AND utilise_le IS NULL
          `,
          [resetToken.userId]
        );

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}
