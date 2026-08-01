import { Router } from "express";
import { requireLogin, requireRole } from "../middlewares/auth.js";
import { readMultipartFormData } from "../services/multipartService.js";
import { importEmployeeCsv, previewEmployeeCsv } from "../services/employeeCsvImportService.js";

const router = Router();
const MAX_REQUEST_BYTES = 6 * 1024 * 1024;

router.use(requireLogin);
router.use(requireRole("DIRECTION"));

router.post("/preview", async (req, res, next) => {
  try {
    const { files } = await readMultipartFormData(req, { maxBytes: MAX_REQUEST_BYTES });
    res.json(await previewEmployeeCsv(files.csv));
  } catch (error) { next(error); }
});

router.post("/commit", async (req, res, next) => {
  try {
    const { files } = await readMultipartFormData(req, { maxBytes: MAX_REQUEST_BYTES });
    const result = await importEmployeeCsv(files.csv);
    res.status(201).json({ message: `${result.imported} employe(s) importe(s) avec succes.`, ...result });
  } catch (error) { next(error); }
});

export default router;
