import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import { MileageService } from "../services/mileageService.js";

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
        calculatedAt: result.calculatedAt
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

  return router;
}
