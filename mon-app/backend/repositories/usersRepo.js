import crypto from "node:crypto";

export function createUsersRepo(db) {
  return {
    async findById(id) {
      const [rows] = await db.execute(
        `
          SELECT
            u.id,
            u.courriel AS email,
            u.mot_de_passe_hash AS passwordHash,
            NOT u.mot_de_passe_updated AS mustChangePassword,
            u.prenom AS firstName,
            u.nom AS lastName,
            u.role,
            u.statut AS status,
            e.code_permanent AS codePermanent,
            e.code_etudiant AS studentCode,
            COALESCE(s.numero_employe, cpt.numero_employe) AS employeeNumber,
            s.taux_kilometrique AS mileageRate,
            co.departement AS department,
            cpt.service,
            dir.titre AS title
          FROM utilisateurs u
          LEFT JOIN etudiants e ON e.utilisateur_id = u.id
          LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
          LEFT JOIN conseillere co ON co.utilisateur_id = u.id
          LEFT JOIN comptabilite cpt ON cpt.utilisateur_id = u.id
          LEFT JOIN direction dir ON dir.utilisateur_id = u.id
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
            NOT u.mot_de_passe_updated AS mustChangePassword,
            u.prenom AS firstName,
            u.nom AS lastName,
            u.role,
            u.statut AS status,
            e.code_permanent AS codePermanent,
            e.code_etudiant AS studentCode,
            COALESCE(s.numero_employe, cpt.numero_employe) AS employeeNumber,
            s.taux_kilometrique AS mileageRate,
            co.departement AS department,
            cpt.service,
            dir.titre AS title
          FROM utilisateurs u
          LEFT JOIN etudiants e ON e.utilisateur_id = u.id
          LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
          LEFT JOIN conseillere co ON co.utilisateur_id = u.id
          LEFT JOIN comptabilite cpt ON cpt.utilisateur_id = u.id
          LEFT JOIN direction dir ON dir.utilisateur_id = u.id
          WHERE
            LOWER(u.courriel) = ?
            OR LOWER(e.code_permanent) = ?
            OR LOWER(e.code_etudiant) = ?
            OR LOWER(s.numero_employe) = ?
            OR LOWER(cpt.numero_employe) = ?
          LIMIT 1
        `,
        [
          normalizedIdentifier,
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

    async setFirstLoginPassword(userId, passwordHash) {
      const [result] = await db.execute(
        `
          UPDATE utilisateurs
          SET
            mot_de_passe_hash = ?,
            mot_de_passe_updated = TRUE
          WHERE id = ?
            AND mot_de_passe_updated = FALSE
        `,
        [passwordHash, userId]
      );

      return result.affectedRows > 0;
    },

    async createPasswordResetCode(userId, codeHash, expiresAt) {
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
        [userId, codeHash, expiresAt]
      );
    },

    async verifyPasswordResetCode({
      userId,
      codeHash,
      sessionTokenHash,
      sessionExpiresAt,
      maxAttempts
    }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
          `
            SELECT id, token_hash AS codeHash, nombre_tentatives AS attempts
            FROM password_reset_tokens
            WHERE
              utilisateur_id = ?
              AND utilise_le IS NULL
              AND verifie_le IS NULL
              AND expire_le > CURRENT_TIMESTAMP
            ORDER BY cree_le DESC
            LIMIT 1
            FOR UPDATE
          `,
          [userId]
        );

        const resetCode = rows[0];

        if (!resetCode || resetCode.attempts >= maxAttempts) {
          await connection.rollback();
          return false;
        }

        const nextAttempts = resetCode.attempts + 1;
        const matches = crypto.timingSafeEqual(
          Buffer.from(resetCode.codeHash, "hex"),
          Buffer.from(codeHash, "hex")
        );

        if (!matches) {
          await connection.execute(
            "UPDATE password_reset_tokens SET nombre_tentatives = ? WHERE id = ?",
            [nextAttempts, resetCode.id]
          );
          await connection.commit();
          return false;
        }

        await connection.execute(
          `
            UPDATE password_reset_tokens
            SET
              nombre_tentatives = ?,
              verifie_le = CURRENT_TIMESTAMP,
              session_token_hash = ?,
              session_expire_le = ?
            WHERE id = ?
          `,
          [nextAttempts, sessionTokenHash, sessionExpiresAt, resetCode.id]
        );

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async consumePasswordResetSession(sessionTokenHash, passwordHash) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [rows] = await connection.execute(
          `
            SELECT id, utilisateur_id AS userId
            FROM password_reset_tokens
            WHERE
              session_token_hash = ?
              AND verifie_le IS NOT NULL
              AND utilise_le IS NULL
              AND session_expire_le > CURRENT_TIMESTAMP
            LIMIT 1
            FOR UPDATE
          `,
          [sessionTokenHash]
        );

        const resetSession = rows[0];

        if (!resetSession) {
          await connection.rollback();
          return false;
        }

        await connection.execute(
          `
            UPDATE utilisateurs
            SET
              mot_de_passe_hash = ?,
              mot_de_passe_updated = TRUE
            WHERE id = ?
          `,
          [passwordHash, resetSession.userId]
        );
        await connection.execute(
          `
            UPDATE password_reset_tokens
            SET utilise_le = CURRENT_TIMESTAMP
            WHERE utilisateur_id = ? AND utilise_le IS NULL
          `,
          [resetSession.userId]
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
