import express from "express";
import dotenv from "dotenv";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import authRoutes from "./routes/authRoute.js";
import mileageRoutes from "./routes/mileageRoute.js";
import studentRoutes from "./routes/studentRoute.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { createDbPool } from "./config/db.js";
import { createMileageTripsRepo } from "./repositories/mileageTripsRepo.js";
import { createUsersRepo } from "./repositories/usersRepo.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = createHttpServer(app);
const db = createDbPool();
const usersRepo = createUsersRepo(db);
const mileageTripsRepo = createMileageTripsRepo(db);

app.use(express.json());

app.use("/api/auth", authRoutes({ usersRepo }));
app.use("/api/students", studentRoutes);
app.use("/api/mileage", mileageRoutes({ mileageTripsRepo }));

const vite = await createViteServer({
  root: appRoot,
  server: {
    middlewareMode: true,
    hmr: {
      server
    }
  },
  appType: "spa"
});

app.use(vite.middlewares);

app.use(errorHandler);

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Serveur lance sur http://localhost:${port}`);
});
