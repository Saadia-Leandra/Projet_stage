import "./config/env.js";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const ca = process.env.DB_CA_PATH
  ? await readFile(process.env.DB_CA_PATH, "utf8")
  : process.env.DB_CA_CERT?.replace(/\\n/g, "\n");
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "stagetec",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  ...(process.env.DB_SSL === "true" ? { ssl: { ca, rejectUnauthorized: true } } : {})
});

const columns = [
  ["utilisateurs", "telephone_secondaire", "VARCHAR(40) NULL AFTER telephone"],
  ["etudiants", "session", "VARCHAR(30) NULL AFTER groupe"],
  ["etudiants", "numero_cours", "VARCHAR(30) NULL AFTER session"],
  ["etudiants", "titre_cours", "VARCHAR(160) NULL AFTER numero_cours"],
  ["etudiants", "discipline", "VARCHAR(160) NULL AFTER titre_cours"],
  ["etudiants", "horaire", "VARCHAR(500) NULL AFTER discipline"],
  ["etudiants", "ponderation", "VARCHAR(30) NULL AFTER horaire"],
  ["etudiants", "date_debut_groupe", "DATE NULL AFTER ponderation"],
  ["etudiants", "date_fin_groupe", "DATE NULL AFTER date_debut_groupe"]
];

try {
  for (const [table, column, definition] of columns) {
    const [existing] = await connection.execute(
      `SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [process.env.DB_NAME || "stagetec", table, column]
    );
    if (!existing.length) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
      console.log(`Colonne ajoutée : ${table}.${column}`);
    }
  }
  console.log("Migration des colonnes Clara terminée.");
} finally {
  await connection.end();
}
