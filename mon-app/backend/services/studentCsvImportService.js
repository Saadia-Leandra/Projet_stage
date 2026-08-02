import { createDbPool } from "../config/db.js";
import { DEFAULT_INITIAL_PASSWORD, hashPassword } from "./password.js";

const db = createDbPool();
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const HEADERS = [
  "courriel",
  "prenom",
  "nom",
  "telephone",
  "telephone_secondaire",
  "nom_prenom",
  "mot_de_passe_temporaire",
  "code_etudiant",
  "programme",
  "cohorte",
  "adresse",
  "ville",
  "province",
  "code_postal",
  "code_permanent",
  "groupe",
  "expiration_caq",
  "expiration_permis_etudes",
  "expiration_assurance",
  "numero_employe_superviseur",
  "session",
  "numero_cours",
  "titre_cours",
  "discipline",
  "horaire",
  "ponderation",
  "date_debut_groupe",
  "date_fin_groupe"
];
const REQUIRED_HEADERS = new Set([
  "courriel",
  "prenom",
  "nom",
  "code_etudiant",
  "programme"
]);
const DATE_HEADERS = [
  "expiration_caq",
  "expiration_permis_etudes",
  "expiration_assurance",
  "date_debut_groupe",
  "date_fin_groupe"
];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const HEADER_ALIASES = {
  courriel: "courriel",
  email: "courriel",
  prenom: "prenom",
  nom: "nom",
  nom_prenom: "nom_prenom",
  telephone: "telephone",
  telephone_principal: "telephone",
  telephone_secondaire: "telephone_secondaire",
  telephone_sec: "telephone_secondaire",
  mot_de_passe_temporaire: "mot_de_passe_temporaire",
  mot_de_passe: "mot_de_passe_temporaire",
  password: "mot_de_passe_temporaire",
  code_etudiant: "code_etudiant",
  numero_dossier: "code_etudiant",
  programme: "programme",
  spe: "programme",
  numero_programme: "programme",
  numero_grille: "groupe",
  code_permanent: "code_permanent",
  adresse: "adresse",
  ville: "ville",
  province: "province",
  code_postal: "code_postal",
  groupe: "groupe",
  expiration_caq: "expiration_caq",
  expiration_permis_etudes: "expiration_permis_etudes",
  expiration_assurance: "expiration_assurance",
  numero_employe_superviseur: "numero_employe_superviseur",
  titulaire: "numero_employe_superviseur",
  titulaires: "numero_employe_superviseur",
  code_titulaire: "numero_employe_superviseur",
  encadreur: "numero_employe_superviseur",
  session: "session",
  numero_cours: "numero_cours",
  no_cours: "numero_cours",
  titre_du_cours: "titre_cours",
  titre_cours: "titre_cours",
  discipline: "discipline",
  horaire: "horaire",
  ponderation: "ponderation",
  date_de_debut: "date_debut_groupe",
  date_debut: "date_debut_groupe",
  date_de_fin: "date_fin_groupe",
  date_fin: "date_fin_groupe",
  no_etu: "code_etudiant",
  no_prog: "programme",
  no_grille: "groupe",
  telephone_princ: "telephone",
  telephone_sec: "telephone_secondaire"
};

export async function previewStudentCsv(file) {
  validateCsvFile(file);
  return normalizeCsv(file);
}

export async function importStudentCsv(file) {
  validateCsvFile(file);
  const preview = await normalizeCsv(file);

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
      const passwordHash = await hashPassword(DEFAULT_INITIAL_PASSWORD);
      const [userResult] = await connection.execute(
        `
          INSERT INTO utilisateurs (
            courriel, mot_de_passe_hash, mot_de_passe_updated,
            prenom, nom, telephone, telephone_secondaire, role, statut
          )
          VALUES (?, ?, FALSE, ?, ?, ?, ?, 'ETUDIANT', 'ACTIF')
        `,
        [
          row.courriel,
          passwordHash,
          row.prenom,
          row.nom,
          nullable(row.telephone),
          nullable(row.telephone_secondaire)
        ]
      );

      await connection.execute(
        `
          INSERT INTO etudiants (
            utilisateur_id, superviseur_id, code_etudiant, programme, cohorte,
            adresse, ville, province, code_postal, code_permanent, groupe,
            expiration_caq, expiration_permis_etudes, expiration_assurance,
            session, numero_cours, titre_cours, discipline, horaire,
            ponderation, date_debut_groupe, date_fin_groupe
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          nullable(row.expiration_assurance),
          nullable(row.session),
          nullable(row.numero_cours),
          nullable(row.titre_cours),
          nullable(row.discipline),
          nullable(row.horaire),
          nullable(row.ponderation),
          nullable(row.date_debut_groupe),
          nullable(row.date_fin_groupe)
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

  const supervisorCode = extractSupervisorCode(employeeNumber);

  const [rows] = await connection.execute(
    `
      SELECT utilisateur_id AS id
      FROM superviseurs
      WHERE UPPER(numero_employe) = UPPER(?)
      LIMIT 1
    `,
    [supervisorCode]
  );

  if (!rows[0]) {
    const error = new Error(
      `Encadreur introuvable pour le titulaire Clara : ${employeeNumber} (code ${supervisorCode}).`
    );
    error.status = 400;
    throw error;
  }

  return rows[0].id;
}

function extractSupervisorCode(value) {
  const text = String(value || "").trim();
  const parenthesizedCodes = [...text.matchAll(/\(([A-Za-z0-9_-]+)\)/g)];
  return parenthesizedCodes.at(-1)?.[1] || text;
}

function normalizeCsv(file) {
  const rawText = file.buffer.toString("utf-8");
  const text = rawText.replace(/^\uFEFF/, "");

  if (!text.trim()) {
    const error = new Error("Le fichier CSV est vide.");
    error.status = 400;
    throw error;
  }

  const delimiter = sniffDelimiter(text);
  const rows = parseCsv(text, delimiter);

  if (rows.length === 0) {
    const error = new Error("Le fichier CSV est vide.");
    error.status = 400;
    throw error;
  }

  const headers = rows[0].map((header) => String(header || "").trim());
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const missingHeaders = [...REQUIRED_HEADERS].filter(
    (header) => !normalizedHeaders.includes(header)
  );

  if (missingHeaders.length) {
    const error = new Error(
      "Colonnes obligatoires manquantes : " + missingHeaders.join(", ") + "."
    );
    error.status = 400;
    throw error;
  }

  const resultRows = [];
  const errors = [];
  const seenEmails = {};
  const seenCodes = {};

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const sourceRow = rows[rowIndex];
    if (sourceRow.length > headers.length) {
      errors.push({
        ligne: rowIndex + 1,
        erreurs: ["La ligne contient plus de colonnes que l'en-tête."]
      });
      continue;
    }

    const row = HEADERS.reduce((acc, header) => {
      acc[header] = "";
      return acc;
    }, {});

    sourceRow.forEach((value, index) => {
      const name = normalizedHeaders[index];
      if (name) {
        row[name] = String(value || "").trim();
      }
    });

    if (row.nom_prenom && (!row.nom || !row.prenom)) {
      const [nom, ...prenoms] = row.nom_prenom.split(",");
      row.nom ||= nom.trim();
      row.prenom ||= prenoms.join(",").trim();
    }

    row.mot_de_passe_temporaire = DEFAULT_INITIAL_PASSWORD;

    if (!Object.values(row).some((value) => value !== "")) {
      continue;
    }

    if (!Object.values(row).some((value) => value !== "")) {
      continue;
    }

    row.courriel = row.courriel.toLowerCase();
    const rowErrors = validateRow(row, seenEmails, seenCodes, rowIndex + 1);
    resultRows.push(row);
    if (rowErrors.length) {
      errors.push({ ligne: rowIndex + 1, erreurs: rowErrors });
    }
  }

  if (resultRows.length === 0) {
    const error = new Error("Le fichier CSV ne contient aucune ligne de données.");
    error.status = 400;
    throw error;
  }

  return {
    valide: errors.length === 0,
    nombreLignes: resultRows.length,
    nombreValides: resultRows.length - errors.length,
    nombreErreurs: errors.length,
    lignes: resultRows,
    erreurs: errors
  };
}

function sniffDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsv(text, delimiter) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      current.push(field);
      field = "";
      continue;
    }

    if (char === '\r') {
      if (nextChar === '\n') {
        index += 1;
      }
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }

    if (char === '\n') {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
      continue;
    }

    field += char;
  }

  current.push(field);
  rows.push(current);

  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  return rows;
}

function normalizeHeader(header) {
  const key = String(header || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return HEADER_ALIASES[key] || key;
}

function validateRow(row, seenEmails, seenCodes, lineNumber) {
  const errors = [];

  [...REQUIRED_HEADERS].sort().forEach((header) => {
    if (!row[header]) {
      errors.push(`La colonne ${header} est obligatoire.`);
    }
  });

  if (row.courriel && !EMAIL_PATTERN.test(row.courriel)) {
    errors.push("Le courriel est invalide.");
  }

  if (row.mot_de_passe_temporaire && row.mot_de_passe_temporaire.length < 8) {
    errors.push("Le mot de passe temporaire doit contenir au moins 8 caractères.");
  }

  DATE_HEADERS.forEach((header) => {
    const value = row[header];
    if (value) {
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
        errors.push(`La colonne ${header} doit respecter le format AAAA-MM-JJ.`);
      } else {
        const parts = value.split("-").map(Number);
        const dateValue = new Date(parts[0], parts[1] - 1, parts[2]);
        if (
          dateValue.getFullYear() !== parts[0] ||
          dateValue.getMonth() !== parts[1] - 1 ||
          dateValue.getDate() !== parts[2]
        ) {
          errors.push(`La colonne ${header} doit respecter le format AAAA-MM-JJ.`);
        }
      }
    }
  });

  recordDuplicate(errors, seenEmails, row.courriel, lineNumber, "courriel");
  recordDuplicate(errors, seenCodes, row.code_etudiant, lineNumber, "code étudiant");

  return errors;
}

function recordDuplicate(errors, seen, value, lineNumber, label) {
  const key = String(value || "").toLowerCase();
  if (!key) return;
  if (seen[key]) {
    errors.push(`Le ${label} est déjà présent à la ligne ${seen[key]}.`);
  } else {
    seen[key] = lineNumber;
  }
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
