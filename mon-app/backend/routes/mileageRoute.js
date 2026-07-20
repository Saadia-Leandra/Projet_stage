import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import { MileageService } from "../services/mileageService.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const receiptDirectory = path.resolve("backend", "uploads", "parking-receipts");

export default function mileageRoutes({ mileageTripsRepo }) {
  const router = Router();
  const mileageService = new MileageService();

  router.use(requireLogin);

  router.get("/settings", requireRole("SUPERVISEUR"), async (req, res, next) => {
    try {
      const ratePerKm = await mileageTripsRepo.getSupervisorRate(req.user.id);

      res.json({ ratePerKm });
    } catch (error) {
      next(error);
    }
  });

  router.get("/students", requireRole("SUPERVISEUR"), async (req, res, next) => {
    try {
      const students = await mileageTripsRepo.listSupervisorStudents(req.user.id);

      res.json({ students });
    } catch (error) {
      next(error);
    }
  });

  router.post("/calculate", requireRole("SUPERVISEUR"), async (req, res, next) => {
    try {
      const ratePerKm = await mileageTripsRepo.getSupervisorRate(req.user.id);
      const result = await mileageService.calculate(req.body);
      const parkingReceipt = await saveParkingReceipt(req.body.parkingReceipt);
      const trip = await mileageTripsRepo.create({
        supervisorUserId: req.user.id,
        campus: req.body.campus,
        program: req.body.program,
        group: req.body.group,
        tripDate: req.body.tripDate,
        parkingAmount: Number(req.body.parkingAmount || 0),
        ratePerKm,
        mapUrl: result.mapUrl,
        distanceKm: result.distanceKm,
        durationMinutes: result.durationMinutes,
        provider: result.provider,
        tripType: result.tripType,
        destinations: result.destinations,
        calculatedAt: result.calculatedAt,
        gpsTrace: normalizeGpsTrace(req.body.gpsTrace),
        startedAt: req.body.startedAt || result.calculatedAt,
        endedAt: req.body.endedAt || result.calculatedAt,
        parkingReceipt
      });

      res.status(201).json({
        ...result,
        ratePerKm,
        tripId: trip.id
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/trips", requireRole("SUPERVISEUR", "COMPTABILITE", "CONSEILLERE"), async (req, res, next) => {
    try {
      const supervisorUserId = req.user.role === "SUPERVISEUR" ? req.user.id : null;

      res.json({ trips: await mileageTripsRepo.list(supervisorUserId) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/trips/:id/parking-receipt", requireRole("SUPERVISEUR", "COMPTABILITE", "DIRECTION", "CONSEILLERE"), async (req, res, next) => {
    try {
      const receipt = await mileageTripsRepo.findReceipt(req.params.id, req.user);
      if (!receipt?.storedName) {
        const error = new Error("Preuve de stationnement introuvable.");
        error.status = 404;
        throw error;
      }
      const contents = await readFile(path.join(receiptDirectory, path.basename(receipt.storedName)));
      res.set("Content-Type", receipt.type).set("Content-Disposition", `inline; filename="${path.basename(receipt.name)}"`).send(contents);
    } catch (error) {
      next(error);
    }
  });
  router.patch("/trips/:id/status", requireRole("COMPTABILITE", "DIRECTION"), async (req, res, next) => {
    try {
      await mileageTripsRepo.updateStatus(req.params.id, req.body.status);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  return router;
}

async function saveParkingReceipt(receipt) {
  if (!receipt) return null;
  const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(receipt.type)) {
    const error = new Error("La preuve doit etre une image ou un PDF.");
    error.status = 400;
    throw error;
  }
  const match = String(receipt.data || "").match(/^data:[^;]+;base64,(.+)$/);
  const contents = match ? Buffer.from(match[1], "base64") : null;
  if (!contents?.length || contents.length > 10 * 1024 * 1024) {
    const error = new Error("La preuve est vide ou depasse 10 Mo.");
    error.status = 400;
    throw error;
  }
  await mkdir(receiptDirectory, { recursive: true });
  const storedName = `${randomUUID()}${path.extname(receipt.name).toLowerCase()}`;
  await writeFile(path.join(receiptDirectory, storedName), contents, { flag: "wx" });
  return { name: path.basename(receipt.name), type: receipt.type, storedName };
}

function normalizeGpsTrace(trace) {
  if (!Array.isArray(trace)) return [];
  return trace.slice(0, 10000).map((point) => ({
    lat: Number(point.lat), lng: Number(point.lng), accuracy: Number(point.accuracy || 0),
    recordedAt: new Date(point.recordedAt).toISOString()
  })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}


