import { createDbPool } from "../config/db.js";
import { hashPassword } from "./password.js";

const db = createDbPool();
const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function previewStudentCsv(file) {
  validateCsvFile(file);
  return normalizeWithPython(file);
}

export async function importStudentCsv(file) {
  validateCsvFile(file);
  const preview = await normalizeWithPython(file);

  if (!preview.valide) {
    const error = new Error(
      "Le fichier contient des erreurs. Corrigez-le avant de lancer l'importation."
    );
    error.status = 400;
    error.details = preview;
    throw error;
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    await assertNoDatabaseDuplicates(connection, preview.lignes);

    let imported = 0;

    for (const row of preview.lignes) {
      const supervisorId = await findSupervisorId(
        connection,
        row.numero_employe_superviseur
      );
      const passwordHash = await hashPassword(row.mot_de_passe_temporaire);
      const [userResult] = await connection.execute(
        `
          INSERT INTO utilisateurs (
            courriel, mot_de_passe_hash, prenom, nom, telephone, role, statut
          )
          VALUES (?, ?, ?, ?, ?, 'ETUDIANT', 'ACTIF')
        `,
        [
          row.courriel,
          passwordHash,
          row.prenom,
          row.nom,
          nullable(row.telephone)
        ]
      );

      await connection.execute(
        `
          INSERT INTO etudiants (
            utilisateur_id, superviseur_id, code_etudiant, programme, cohorte,
            adresse, ville, province, code_postal, code_permanent, groupe,
            expiration_caq, expiration_permis_etudes, expiration_assurance
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userResult.insertId,
          supervisorId,
          row.code_etudiant,
          row.programme,
          nullable(row.cohorte),
          nullable(row.adresse),
          nullable(row.ville),
          nullable(row.province),
          nullable(row.code_postal),
          nullable(row.code_permanent),
          nullable(row.groupe),
          nullable(row.expiration_caq),
          nullable(row.expiration_permis_etudes),
          nullable(row.expiration_assurance)
        ]
      );

      await connection.execute(
        `
          INSERT INTO dossiers_stage (etudiant_id, superviseur_id)
          VALUES (?, ?)
        `,
        [userResult.insertId, supervisorId]
      );
      imported += 1;
    }

    await connection.commit();
    return { imported };
  } catch (error) {
    await connection.rollback();
    throw normalizeDatabaseError(error);
  } finally {
    connection.release();
  }
}

async function normalizeWithPython(file) {
  const baseUrl = process.env.CSV_SERVICE_URL || "http://127.0.0.1:8001";
  let response;

  try {
    response = await fetch(`${baseUrl}/v1/students/normalize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CSV_SERVICE_TOKEN
          ? { "X-Service-Token": process.env.CSV_SERVICE_TOKEN }
          : {})
      },
      body: JSON.stringify({
        nomFichier: file.fileName,
        contenuBase64: file.buffer.toString("base64")
      }),
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    const error = new Error(
      "Le service Python d'import CSV est indisponible. Demarrez-le sur le port 8001."
    );
    error.status = 503;
    throw error;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload.erreur || "Le service Python n'a pas pu analyser le CSV."
    );
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }

  return payload;
}

async function assertNoDatabaseDuplicates(connection, rows) {
  const emails = rows.map((row) => row.courriel);
  const codes = rows.map((row) => row.code_etudiant);
  const placeholders = (values) => values.map(() => "?").join(", ");
  const [duplicates] = await connection.execute(
    `
      SELECT u.courriel AS email, e.code_etudiant AS studentCode
      FROM utilisateurs u
      LEFT JOIN etudiants e ON e.utilisateur_id = u.id
      WHERE u.courriel IN (${placeholders(emails)})
         OR e.code_etudiant IN (${placeholders(codes)})
    `,
    [...emails, ...codes]
  );

  if (duplicates.length) {
    const values = duplicates
      .flatMap((row) => [row.email, row.studentCode])
      .filter(Boolean)
      .join(", ");
    const error = new Error(
      `Importation annulee : ces comptes existent deja dans la base : ${values}.`
    );
    error.status = 409;
    throw error;
  }
}

async function findSupervisorId(connection, employeeNumber) {
  if (!employeeNumber) return null;

  const [rows] = await connection.execute(
    `
      SELECT utilisateur_id AS id
      FROM superviseurs
      WHERE numero_employe = ?
      LIMIT 1
    `,
    [employeeNumber]
  );

  if (!rows[0]) {
    const error = new Error(
      `Superviseur introuvable : ${employeeNumber}.`
    );
    error.status = 400;
    throw error;
  }

  return rows[0].id;
}

function validateCsvFile(file) {
  if (!file?.buffer?.length) {
    const error = new Error("Selectionnez un fichier CSV.");
    error.status = 400;
    throw error;
  }

  if (
    !file.fileName?.toLowerCase().endsWith(".csv") ||
    file.buffer.length > MAX_CSV_BYTES
  ) {
    const error = new Error("Le fichier doit etre un CSV de 5 Mo maximum.");
    error.status = 400;
    throw error;
  }
}

function normalizeDatabaseError(error) {
  if (error.status) return error;
  if (error.code === "ER_DUP_ENTRY") {
    error.message = "Une valeur unique existe deja dans la base.";
    error.status = 409;
  }
  return error;
}

function nullable(value) {
  return value || null;
}
