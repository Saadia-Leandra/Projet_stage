import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

dotenv.config({ path: "backend/.env" });

export function createDbPool() {
  const ssl = createSslConfig();

  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "stagetec",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    ...(ssl ? { ssl } : {}),
    waitForConnections: true,
    connectionLimit: 10
  });
}

function createSslConfig() {
  if (process.env.DB_SSL !== "true") return null;

  const inlineCertificate = process.env.DB_CA_CERT?.replace(/\\n/g, "\n");
  const ca = inlineCertificate || (process.env.DB_CA_PATH
    ? readFileSync(process.env.DB_CA_PATH, "utf8")
    : null);

  if (!ca) {
    throw new Error("DB_SSL=true exige DB_CA_PATH ou DB_CA_CERT.");
  }

  return { ca, rejectUnauthorized: true };
}
