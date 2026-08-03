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

const columns = [
  ["resoumis_le", "DATETIME NULL AFTER motif_refus"]
];

try {
  for (const [name, definition] of columns) {
    const [rows] = await connection.execute(
      `SELECT 1 FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'charges_paie_supervision'
         AND COLUMN_NAME = ? LIMIT 1`,
      [database, name]
    );
    if (!rows.length) {
      await connection.query(`ALTER TABLE charges_paie_supervision ADD COLUMN \`${name}\` ${definition}`);
    }
  }
  console.log("La resoumission des charges de paie est prête.");
} finally {
  await connection.end();
}
