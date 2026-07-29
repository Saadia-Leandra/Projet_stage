import express from "express";
import dotenv from "dotenv";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import authRoutes from "./routes/authRoute.js";
import contractRoutes from "./routes/contractRoute.js";
import documensoWebhookRoutes from "./routes/documensoWebhookRoute.js";
import mileageRoutes from "./routes/mileageRoute.js";
import notificationRoutes from "./routes/notificationRoute.js";
import payrollRoutes from "./routes/payrollRoute.js";
import stageManagementRoutes from "./routes/stageManagementRoute.js";
import studentRoutes from "./routes/studentRoute.js";
import studentImportRoutes from "./routes/studentImportRoute.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { createDbPool } from "./config/db.js";
import { createMileageTripsRepo } from "./repositories/mileageTripsRepo.js";
import { createPayrollRepo } from "./repositories/payrollRepo.js";
import { createUsersRepo } from "./repositories/usersRepo.js";
import supervisorStageRoutes from "./routes/supervisorStageRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const server = createHttpServer(app);
const db = createDbPool();
const usersRepo = createUsersRepo(db);
const mileageTripsRepo = createMileageTripsRepo(db);
const payrollRepo = createPayrollRepo(db);

app.use(express.json({ limit: "15mb" }));

app.use("/api/auth", authRoutes({ usersRepo }));
app.use("/api/webhooks", documensoWebhookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/student-imports", studentImportRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/stage-management", stageManagementRoutes);
app.use("/api/mileage", mileageRoutes({ mileageTripsRepo }));
app.use("/api/supervisor/stages", supervisorStageRoutes);
app.use("/api/payroll", payrollRoutes({ payrollRepo }));

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
