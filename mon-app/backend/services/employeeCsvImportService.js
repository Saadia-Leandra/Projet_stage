import { createDbPool } from "../config/db.js";
import { DEFAULT_INITIAL_PASSWORD, hashPassword } from "./password.js";

const db = createDbPool();
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const ALLOWED_ROLES = new Set(["SUPERVISEUR", "CONSEILLERE", "COMPTABILITE"]);
const HEADERS = [
  "courriel", "prenom", "nom", "telephone", "telephone_secondaire", "role",
  "numero_employe", "departement", "service", "taux_horaire",
  "taux_kilometrique"
];
const REQUIRED_HEADERS = new Set(["courriel", "prenom", "nom", "role"]);
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function previewEmployeeCsv(file) {
  validateCsvFile(file);
  return normalizeCsv(file);
}

export async function importEmployeeCsv(file) {
  validateCsvFile(file);
  const preview = normalizeCsv(file);
  if (!preview.valide) {
    const error = new Error("Le fichier contient des erreurs. Corrigez-le avant de lancer l'importation.");
    error.status = 400;
    error.details = preview;
    throw error;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await assertNoDatabaseDuplicates(connection, preview.lignes);
    for (const row of preview.lignes) {
      const passwordHash = await hashPassword(DEFAULT_INITIAL_PASSWORD);
      const [result] = await connection.execute(
        `INSERT INTO utilisateurs
          (courriel, mot_de_passe_hash, mot_de_passe_updated, prenom, nom,
           telephone, telephone_secondaire, role, statut)
         VALUES (?, ?, FALSE, ?, ?, ?, ?, ?, 'ACTIF')`,
        [row.courriel, passwordHash, row.prenom, row.nom, nullable(row.telephone),
          nullable(row.telephone_secondaire), row.role]
      );
      await insertRoleProfile(connection, result.insertId, row);
    }
    await connection.commit();
    return { imported: preview.lignes.length };
  } catch (error) {
    await connection.rollback();
    throw normalizeDatabaseError(error);
  } finally {
    connection.release();
  }
}

async function insertRoleProfile(connection, userId, row) {
  if (row.role === "SUPERVISEUR") {
    await connection.execute(
      `INSERT INTO superviseurs
        (utilisateur_id, numero_employe, departement, taux_horaire, taux_kilometrique)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, row.numero_employe, nullable(row.departement), row.taux_horaire,
        row.taux_kilometrique || "0.610"]
    );
  } else if (row.role === "CONSEILLERE") {
    await connection.execute(
      "INSERT INTO conseillere (utilisateur_id, departement) VALUES (?, ?)",
      [userId, nullable(row.departement)]
    );
  } else {
    await connection.execute(
      "INSERT INTO comptabilite (utilisateur_id, numero_employe, service) VALUES (?, ?, ?)",
      [userId, row.numero_employe, nullable(row.service)]
    );
  }
}

async function assertNoDatabaseDuplicates(connection, rows) {
  const emails = rows.map((row) => row.courriel);
  const employeeNumbers = rows.map((row) => row.numero_employe).filter(Boolean);
  const emailMarks = emails.map(() => "?").join(", ");
  const employeeClause = employeeNumbers.length
    ? ` OR s.numero_employe IN (${employeeNumbers.map(() => "?").join(", ")})
        OR c.numero_employe IN (${employeeNumbers.map(() => "?").join(", ")})`
    : "";
  const [duplicates] = await connection.execute(
    `SELECT u.courriel, COALESCE(s.numero_employe, c.numero_employe) AS numero_employe
       FROM utilisateurs u
       LEFT JOIN superviseurs s ON s.utilisateur_id = u.id
       LEFT JOIN comptabilite c ON c.utilisateur_id = u.id
      WHERE u.courriel IN (${emailMarks})${employeeClause}`,
    [...emails, ...employeeNumbers, ...employeeNumbers]
  );
  if (duplicates.length) {
    const values = duplicates.flatMap((row) => [row.courriel, row.numero_employe]).filter(Boolean);
    const error = new Error(`Importation annulee : ces comptes existent deja : ${values.join(", ")}.`);
    error.status = 409;
    throw error;
  }
}

function normalizeCsv(file) {
  const text = file.buffer.toString("utf-8").replace(/^\uFEFF/, "");
  if (!text.trim()) throw httpError("Le fichier CSV est vide.");
  const rows = parseCsv(text, sniffDelimiter(text));
  const sourceHeaders = rows.shift()?.map(normalizeHeader) || [];
  const missing = [...REQUIRED_HEADERS].filter((header) => !sourceHeaders.includes(header));
  if (missing.length) throw httpError(`Colonnes obligatoires manquantes : ${missing.join(", ")}.`);

  const lignes = [];
  const erreurs = [];
  const seenEmails = new Map();
  const seenNumbers = new Map();
  rows.forEach((values, index) => {
    const line = index + 2;
    if (!values.some((value) => String(value).trim())) return;
    const row = Object.fromEntries(HEADERS.map((header) => [header, ""]));
    values.forEach((value, column) => {
      if (HEADERS.includes(sourceHeaders[column])) row[sourceHeaders[column]] = String(value || "").trim();
    });
    row.courriel = row.courriel.toLowerCase();
    row.role = normalizeRole(row.role);
    row.taux_horaire = normalizeDecimal(row.taux_horaire);
    row.taux_kilometrique = normalizeDecimal(row.taux_kilometrique);
    const rowErrors = validateRow(row, line, seenEmails, seenNumbers);
    lignes.push(row);
    if (rowErrors.length) erreurs.push({ ligne: line, erreurs: rowErrors });
  });
  if (!lignes.length) throw httpError("Le fichier CSV ne contient aucune ligne de donnees.");
  return {
    valide: erreurs.length === 0,
    nombreLignes: lignes.length,
    nombreValides: lignes.length - erreurs.length,
    nombreErreurs: erreurs.length,
    lignes,
    erreurs
  };
}

function validateRow(row, line, seenEmails, seenNumbers) {
  const errors = [];
  [...REQUIRED_HEADERS].forEach((field) => { if (!row[field]) errors.push(`La colonne ${field} est obligatoire.`); });
  if (row.courriel && !EMAIL_PATTERN.test(row.courriel)) errors.push("Le courriel est invalide.");
  if (row.role && !ALLOWED_ROLES.has(row.role)) errors.push("Le role doit etre SUPERVISEUR, CONSEILLERE ou COMPTABILITE.");
  if (["SUPERVISEUR", "COMPTABILITE"].includes(row.role) && !row.numero_employe) {
    errors.push("Le numero_employe est obligatoire pour ce role.");
  }
  if (row.role === "SUPERVISEUR" && (!isPositiveDecimal(row.taux_horaire))) {
    errors.push("Le taux_horaire du superviseur est obligatoire et doit etre superieur a 0.");
  }
  if (row.taux_kilometrique && !isNonNegativeDecimal(row.taux_kilometrique)) {
    errors.push("Le taux_kilometrique doit etre un nombre positif ou nul.");
  }
  recordDuplicate(errors, seenEmails, row.courriel, line, "courriel");
  recordDuplicate(errors, seenNumbers, row.numero_employe, line, "numero d'employe");
  return errors;
}

function recordDuplicate(errors, seen, value, line, label) {
  const key = String(value || "").toLowerCase();
  if (!key) return;
  if (seen.has(key)) errors.push(`Le ${label} est deja present a la ligne ${seen.get(key)}.`);
  else seen.set(key, line);
}

function normalizeRole(value) {
  const role = normalizeHeader(value).toUpperCase();
  return role === "COMPTABLE" ? "COMPTABILITE" : role;
}

function normalizeDecimal(value) {
  return String(value || "").trim().replace(",", ".");
}

function isPositiveDecimal(value) {
  return /^\d+(\.\d{1,3})?$/.test(value) && Number(value) > 0;
}

function isNonNegativeDecimal(value) {
  return /^\d+(\.\d{1,3})?$/.test(value) && Number(value) >= 0;
}

function sniffDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(field); field = ""; }
    else if (char === "\r" || char === "\n") {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += char;
  }
  row.push(field); rows.push(row);
  if (rows.at(-1)?.length === 1 && rows.at(-1)[0] === "") rows.pop();
  return rows;
}

function normalizeHeader(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function validateCsvFile(file) {
  if (!file?.buffer?.length) throw httpError("Selectionnez un fichier CSV.");
  if (!file.fileName?.toLowerCase().endsWith(".csv") || file.buffer.length > MAX_CSV_BYTES) {
    throw httpError("Le fichier doit etre un CSV de 5 Mo maximum.");
  }
}

function httpError(message) {
  const error = new Error(message); error.status = 400; return error;
}

function normalizeDatabaseError(error) {
  if (error.status) return error;
  if (error.code === "ER_DUP_ENTRY") { error.message = "Une valeur unique existe deja dans la base."; error.status = 409; }
  return error;
}

function nullable(value) { return value || null; }
