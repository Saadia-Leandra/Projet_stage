import { Router } from "express";

import {
  processDocumensoWebhook,
  verifyDocumensoWebhookSecret
} from "../services/contractService.js";

const router = Router();

router.post("/documenso", async (req, res, next) => {
  try {
    if (!verifyDocumensoWebhookSecret(req)) {
      return res.status(401).json({
        error: "Signature webhook Documenso invalide."
      });
    }

    const result = await processDocumensoWebhook(
      req.body
    );

    res.status(200).json({
      ok: true,
      ignored: Boolean(result.ignored)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
