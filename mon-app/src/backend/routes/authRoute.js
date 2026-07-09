import { Router } from "express";
import { AuthService } from "../services/authService.js";
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

  router.get("/me", auth, async (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
