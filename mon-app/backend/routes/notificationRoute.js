import { Router } from "express";

import { requireLogin } from "../middlewares/auth.js";
import {
  getUserNotifications,
  markNotificationRead
} from "../services/notificationService.js";

const router = Router();

router.use(requireLogin);

router.get("/", async (req, res, next) => {
  try {
    const notifications = await getUserNotifications(
      req.user.id
    );

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:notificationId/read",
  async (req, res, next) => {
    try {
      const notificationId = Number(
        req.params.notificationId
      );

      if (
        !Number.isInteger(notificationId) ||
        notificationId <= 0
      ) {
        return res.status(400).json({
          error:
            "Identifiant de notification invalide."
        });
      }

      await markNotificationRead(
        req.user.id,
        notificationId
      );

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
