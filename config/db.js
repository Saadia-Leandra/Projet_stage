import mysql from "mysql2/promise";
  import dotenv from "dotenv";

  dotenv.config();

  export const db = await
  mysql.createPool({
    host: process.env.DB_HOST|| "127.0.0.1",
    port:Number(process.env.DB_PORT|| 3306),
    database:process.env.DB_NAME || "stagetec",
    user: process.env.DB_USER|| "root",
    password:process.env.DB_PASSWORD ||"",
    waitForConnections: true,
    connectionLimit: 10
  });