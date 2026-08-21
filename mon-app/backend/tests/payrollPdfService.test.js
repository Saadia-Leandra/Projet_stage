import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

import { createPayrollPdf } from "../services/payrollPdfService.js";

test("genere un rapport de paie PDF valide", async () => {
  const buffer = await createPayrollPdf({
    supervisor: { supervisorName: "Nadia Roy", employeeNumber: "EMP-20", supervisorEmail: "nadia@example.com" },
    charges: [{ createdAt: "2026-08-20", studentCode: "E-100", studentName: "Alice Martin", hours: 4, hourlyRate: 35, amount: 140, status: "VALIDE" }],
    trips: [{ tripDate: "2026-08-19", distanceKm: 25, mileageRate: 0.61, parkingAmount: 5, amount: 20.25, status: "VALIDE" }]
  });
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  const document = await PDFDocument.load(buffer);
  assert.equal(document.getPageCount(), 1);
});
