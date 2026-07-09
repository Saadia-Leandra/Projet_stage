import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "backend/.env" });

export function createDbPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "stagetec",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: 10
  });
}
