import { Router } from "express";
import { auth, requireRole } from "../middlewares/auth.js";
import { UserManagementService } from "../services/userManagementService.js";

export default function userManagementRoutes({ usersRepo }) {
  const router = Router();
  const service = new UserManagementService({ usersRepo });
  router.use(auth, requireRole("DIRECTION"));
  router.get("/", async (_req, res, next) => { try { res.json({ users: await service.list() }); } catch (e) { next(e); } });
  router.post("/", async (req, res, next) => { try { const users = await service.create(req.body); res.status(201).json({ users, count: users.length }); } catch (e) { next(e); } });
  router.patch("/:id", async (req, res, next) => { try { res.json({ user: await service.update(req.params.id, req.body, req.user.id) }); } catch (e) { next(e); } });
  router.delete("/", async (req, res, next) => { try { const count = await service.remove(req.body, req.user.id); res.json({ count }); } catch (e) { next(e); } });
  return router;
}
