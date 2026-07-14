export function createUsersRepo(db) {
  return {
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
            s.numero_employe AS employeeNumber
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

    async findAll() {
      const [rows] = await db.execute(`
        SELECT u.id, u.courriel AS email, u.prenom AS firstName, u.nom AS lastName,
               u.telephone AS phone, u.role, u.statut AS status, u.cree_le AS createdAt,
               e.code_etudiant AS studentCode, e.code_permanent AS permanentCode,
               e.programme AS program, s.numero_employe AS supervisorEmployeeNumber,
               s.departement AS supervisorDepartment, c.numero_employe AS accountingEmployeeNumber,
               c.service AS accountingDepartment, co.departement AS advisorDepartment,
               d.titre AS directionTitle
        FROM utilisateurs u
        LEFT JOIN etudiants e ON e.utilisateur_id = u.id
        LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
        LEFT JOIN comptabilite c ON c.utilisateur_id = u.id
        LEFT JOIN conseillere co ON co.utilisateur_id = u.id
        LEFT JOIN direction d ON d.utilisateur_id = u.id
        ORDER BY u.nom, u.prenom, u.id
      `);
      return rows.map(toManagedUser);
    },

    async createMany(users) {
      return withTransaction(db, async (connection) => {
        const created = [];
        for (const user of users) {
          const [result] = await connection.execute(
            `INSERT INTO utilisateurs
              (courriel, mot_de_passe_hash, prenom, nom, telephone, role, statut)
             VALUES (?, ?, ?, ?, ?, ?, 'ACTIF')`,
            [user.email, user.passwordHash, user.firstName, user.lastName, user.phone, user.role]
          );
          await insertRoleProfile(connection, result.insertId, user);
          created.push({ id: result.insertId, email: user.email, firstName: user.firstName,
            lastName: user.lastName, role: user.role, status: "ACTIF" });
        }
        return created;
      });
    },

    async deleteMany(ids) {
      return withTransaction(db, async (connection) => {
        const placeholders = ids.map(() => "?").join(", ");
        const [result] = await connection.execute(
          `DELETE FROM utilisateurs WHERE id IN (${placeholders})`, ids
        );
        return result.affectedRows;
      });
    },

    async update(id, user) {
      return withTransaction(db, async (connection) => {
        const passwordSql = user.passwordHash ? ", mot_de_passe_hash = ?" : "";
        const values = [user.email, user.firstName, user.lastName, user.phone, user.status];
        if (user.passwordHash) values.push(user.passwordHash);
        values.push(id);
        const [result] = await connection.execute(
          `UPDATE utilisateurs SET courriel = ?, prenom = ?, nom = ?, telephone = ?, statut = ?${passwordSql} WHERE id = ?`,
          values
        );
        if (!result.affectedRows) return null;
        await updateRoleProfile(connection, id, user);
        return { id, email: user.email, firstName: user.firstName, lastName: user.lastName,
          phone: user.phone, role: user.role, status: user.status,
          studentCode: user.studentCode, permanentCode: user.permanentCode,
          program: user.program, employeeNumber: user.employeeNumber, department: user.department };
      });
    }
  };
}

function toManagedUser(row) {
  const employeeNumber = row.role === "SUPERVISEUR" ? row.supervisorEmployeeNumber : row.accountingEmployeeNumber;
  const department = row.role === "SUPERVISEUR" ? row.supervisorDepartment
    : row.role === "COMPTABILITE" ? row.accountingDepartment
    : row.role === "CONSEILLERE" ? row.advisorDepartment : row.directionTitle;
  return { id: row.id, email: row.email, firstName: row.firstName, lastName: row.lastName,
    phone: row.phone, role: row.role, status: row.status, createdAt: row.createdAt,
    studentCode: row.studentCode, permanentCode: row.permanentCode, program: row.program,
    employeeNumber: employeeNumber || null, department: department || null };
}

async function withTransaction(db, action) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function insertRoleProfile(connection, id, user) {
  const statements = {
    ETUDIANT: ["INSERT INTO etudiants (utilisateur_id, code_etudiant, programme, code_permanent) VALUES (?, ?, ?, ?)", [id, user.studentCode, user.program, user.permanentCode]],
    SUPERVISEUR: ["INSERT INTO superviseurs (utilisateur_id, numero_employe, departement) VALUES (?, ?, ?)", [id, user.employeeNumber, user.department]],
    CONSEILLERE: ["INSERT INTO conseillere (utilisateur_id, departement) VALUES (?, ?)", [id, user.department]],
    COMPTABILITE: ["INSERT INTO comptabilite (utilisateur_id, numero_employe, service) VALUES (?, ?, ?)", [id, user.employeeNumber, user.department]],
    DIRECTION: ["INSERT INTO direction (utilisateur_id, titre) VALUES (?, ?)", [id, user.department]]
  };
  const [sql, values] = statements[user.role];
  await connection.execute(sql, values);
}

async function updateRoleProfile(connection, id, user) {
  const statements = {
    ETUDIANT: ["UPDATE etudiants SET code_etudiant = ?, programme = ?, code_permanent = ? WHERE utilisateur_id = ?", [user.studentCode, user.program, user.permanentCode, id]],
    SUPERVISEUR: ["UPDATE superviseurs SET numero_employe = ?, departement = ? WHERE utilisateur_id = ?", [user.employeeNumber, user.department, id]],
    CONSEILLERE: ["UPDATE conseillere SET departement = ? WHERE utilisateur_id = ?", [user.department, id]],
    COMPTABILITE: ["UPDATE comptabilite SET numero_employe = ?, service = ? WHERE utilisateur_id = ?", [user.employeeNumber, user.department, id]],
    DIRECTION: ["UPDATE direction SET titre = ? WHERE utilisateur_id = ?", [user.department, id]]
  };
  const [sql, values] = statements[user.role];
  await connection.execute(sql, values);
}
