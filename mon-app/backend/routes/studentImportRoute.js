import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import { readMultipartFormData } from "../services/multipartService.js";
import {
  importStudentCsv,
  previewStudentCsv
} from "../services/studentCsvImportService.js";

const router = Router();
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

router.use(requireLogin);
router.use(requireRole("CONSEILLERE"));

router.post("/preview", async (req, res, next) => {
  try {
    const { files } = await readMultipartFormData(req, {
      maxBytes: MAX_REQUEST_BYTES
    });
    const preview = await previewStudentCsv(files.csv);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

router.post("/commit", async (req, res, next) => {
  try {
    const { files } = await readMultipartFormData(req, {
      maxBytes: MAX_REQUEST_BYTES
    });
    const result = await importStudentCsv(files.csv);
    res.status(201).json({
      message: `${result.imported} etudiant(s) importe(s) avec succes.`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
