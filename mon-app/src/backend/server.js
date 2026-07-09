import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import authRoutes from "./routes/authRoute.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { createDbPool } from "./config/db.js";
import { createUsersRepo } from "./repositories/usersRepo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const db = createDbPool();
const usersRepo = createUsersRepo(db);

app.use(express.json());

app.use("/api/auth", authRoutes({ usersRepo }));

const vite = await createViteServer({
  root: appRoot,
  server: {
    middlewareMode: true
  },
  appType: "spa"
});

app.use(vite.middlewares);

app.use(errorHandler);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Serveur lance sur http://localhost:${port}`);
});
