import { Router } from "express";
import { AuthService, toPublicUser } from "../services/authService.js";
import { auth } from "../middlewares/auth.js";

export default function authRoutes({ usersRepo }) {
  const router = Router();
  const authService = new AuthService({ usersRepo });

  router.post("/login", async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", auth, async (req, res, next) => {
    try {
      const user = await usersRepo.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }

      res.json({ user: toPublicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
