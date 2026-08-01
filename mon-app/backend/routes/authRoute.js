import { Router } from "express";
import { AuthService, toPublicUser } from "../services/authService.js";
import { auth } from "../middlewares/auth.js";
import { createPasswordResetMailer } from "../services/passwordResetMailer.js";

export default function authRoutes({ usersRepo }) {
  const router = Router();
  const authService = new AuthService({
    usersRepo,
    passwordResetMailer: createPasswordResetMailer()
  });

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

  router.post("/first-login-password", auth, async (req, res, next) => {
    try {
      if (!req.user.mustChangePassword) {
        return res.status(409).json({
          error: "Le changement initial du mot de passe n’est pas requis."
        });
      }

      const result = await authService.completeFirstLogin({
        userId: req.user.id,
        ...req.body
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/forgot-password", async (req, res, next) => {
    try {
      const result = await authService.requestPasswordReset(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/verify-reset-code", async (req, res, next) => {
    try {
      const result = await authService.verifyPasswordResetCode(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/reset-password", async (req, res, next) => {
    try {
      const result = await authService.resetPassword(req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
