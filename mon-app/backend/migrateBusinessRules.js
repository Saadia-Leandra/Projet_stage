import "./config/env.js";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const ca = process.env.DB_CA_PATH
  ? await readFile(process.env.DB_CA_PATH, "utf8")
  : process.env.DB_CA_CERT?.replace(/\\n/g, "\n");
const database = process.env.DB_NAME || "stagetec";
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  database,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  ...(process.env.DB_SSL === "true" ? { ssl: { ca, rejectUnauthorized: true } } : {})
});

try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS etudiants_deplacement_kilometrage (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      deplacement_kilometrage_id BIGINT UNSIGNED NOT NULL,
      superviseur_id BIGINT UNSIGNED NOT NULL,
      etudiant_id BIGINT UNSIGNED NOT NULL,
      date_deplacement DATE NOT NULL,
      UNIQUE KEY uq_kilometrage_superviseur_etudiant_date
        (superviseur_id, etudiant_id, date_deplacement),
      CONSTRAINT fk_etudiants_deplacement_deplacement
        FOREIGN KEY (deplacement_kilometrage_id) REFERENCES deplacements_kilometrage(id) ON DELETE CASCADE,
      CONSTRAINT fk_etudiants_deplacement_superviseur
        FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id),
      CONSTRAINT fk_etudiants_deplacement_etudiant
        FOREIGN KEY (etudiant_id) REFERENCES etudiants(utilisateur_id)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS verrous_charge_paie_supervision (
      superviseur_id BIGINT UNSIGNED NOT NULL,
      etudiant_id BIGINT UNSIGNED NOT NULL,
      cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (superviseur_id, etudiant_id),
      CONSTRAINT fk_verrous_charge_superviseur
        FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id),
      CONSTRAINT fk_verrous_charge_etudiant
        FOREIGN KEY (etudiant_id) REFERENCES etudiants(utilisateur_id)
    ) ENGINE=InnoDB
  `);
  await connection.query(`
    INSERT IGNORE INTO verrous_charge_paie_supervision (superviseur_id, etudiant_id)
    SELECT DISTINCT cps.superviseur_id, ecp.etudiant_id
      FROM charges_paie_supervision cps
      INNER JOIN etudiants_charge_paie ecp
        ON ecp.charge_paie_supervision_id = cps.id
  `);
  console.log("Règles d’unicité de paie et de kilométrage appliquées.");
} finally {
  await connection.end();
}
