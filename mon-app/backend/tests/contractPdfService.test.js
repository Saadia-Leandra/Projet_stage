import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import test from "node:test";

import {
  generateContractPdf,
  resolveContractStoragePath
} from "../services/contractPdfService.js";

test("genere un PDF de contrat valide", async () => {
  const contract = {
    id: 123,
    externalId: "stagetec-test-123",
    studentFirstName: "Marie",
    studentLastName: "Tremblay",
    studentCode: "2600001",
    codeProgram: "420",
    program: "Developpement web",
    schoolYear: "2026",
    session: "ETE",
    companyName: "ACME",
    companyAddress: "100 rue Exemple",
    companyCity: "Montreal",
    companyPostalCode: "H1H 1H1",
    companySupervisorName: "Julie Martin",
    companySupervisorEmail: "julie@example.com",
    teacherFirstName: "Tom",
    teacherLastName: "Prof",
    startDate: "2026-07-10",
    endDate: "2026-08-20",
    workSchedule: "Lundi au vendredi",
    scheduleType: "TEMPS_PLEIN",
    hoursPerWeek: 35,
    numberOfWeeks: 6,
    totalHours: 210,
    functionStage: "Stagiaire developpeur",
    descriptionStage: "Developpement de modules internes.",
    isPaid: true,
    hourlySalary: 20
  };

  const signers = [
    {
      signingOrder: 1,
      role: "ENTREPRISE",
      name: "Julie Martin",
      email: "julie@example.com"
    },
    {
      signingOrder: 2,
      role: "SUPERVISEUR",
      name: "Tom Prof",
      email: "tom@example.com"
    }
  ];

  const file = await generateContractPdf(
    contract,
    signers
  );

  const header = await fs.readFile(file.absolutePath, {
    encoding: "ascii"
  });

  assert.equal(header.slice(0, 5), "%PDF-");
  assert.equal(
    resolveContractStoragePath(file.relativePath),
    file.absolutePath
  );

  await fs.rm(file.absolutePath, { force: true });
});

test("rejette les chemins de stockage relatifs dangereux", () => {
  assert.throws(
    () => resolveContractStoragePath("../secret.pdf"),
    /Chemin de fichier invalide/
  );
});
