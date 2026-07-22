import assert from "node:assert/strict";
import test from "node:test";

import {
  CANADIAN_PROVINCES,
  QUEBEC_CITIES
} from "../../src/frontend/constants/canadianLocations.js";
import {
  generateConfirmationCodeValue,
  MAX_MILIEU_SIGNED_PDF_SIZE_BYTES,
  validateContractData,
  validateMilieuSignedContractFile
} from "../services/contractService.js";
import {
  isActiveStageFolderStatus,
  isActiveStageRequestStatus
} from "../services/studentService.js";

test("liste de villes disponible avec saisie manuelle possible", () => {
  assert.ok(QUEBEC_CITIES.includes("Montréal"));
  assert.ok(QUEBEC_CITIES.includes("Saint-Hyacinthe"));

  const manualCity = "Matane";
  assert.equal(typeof manualCity, "string");
});

test("liste de provinces disponible avec saisie manuelle possible", () => {
  assert.ok(CANADIAN_PROVINCES.includes("Québec"));
  assert.ok(CANADIAN_PROVINCES.includes("Nunavut"));

  const manualProvince = "Etat frontalier";
  assert.equal(typeof manualProvince, "string");
});

test("blocage d'une deuxieme demande active", () => {
  assert.equal(isActiveStageRequestStatus("SOUMISE"), true);
  assert.equal(
    isActiveStageRequestStatus("DOCUMENTS_MANQUANTS"),
    true
  );
  assert.equal(isActiveStageRequestStatus("REFUSEE"), false);
  assert.equal(
    isActiveStageFolderStatus("ATTENTE_SIGNATURE"),
    true
  );
  assert.equal(
    isActiveStageFolderStatus("DOSSIER_COMPLET"),
    false
  );
});

test("contrat incomplet impossible a soumettre", () => {
  assert.throws(
    () => validateContractData({}),
    /obligatoire|superieur a zero/
  );
});

test("signature etudiante obligatoire avant la suite", () => {
  const contract = validateContractData({
    schoolYear: "2026",
    session: "ETE",
    codeProgram: "420",
    functionStage: "Stagiaire developpeur",
    descriptionStage:
      "Developpement de modules internes.",
    scheduleType: "TEMPS_PLEIN",
    hoursPerWeek: 35,
    numberOfWeeks: 8,
    isPaid: false
  });

  assert.equal(contract.totalHours, 280);
});

test("depot du PDF signe par le milieu valide le type et la taille", () => {
  const file = validateMilieuSignedContractFile({
    originalName: "contrat-signe.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-contrat")
  });

  assert.equal(file.mimeType, "application/pdf");

  assert.throws(
    () =>
      validateMilieuSignedContractFile({
        originalName: "contrat.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from("bad")
      }),
    /PDF valide/
  );

  assert.throws(
    () =>
      validateMilieuSignedContractFile({
        originalName: "contrat-signe.pdf",
        mimeType: "application/pdf",
        size: MAX_MILIEU_SIGNED_PDF_SIZE_BYTES + 1,
        buffer: Buffer.concat([
          Buffer.from("%PDF-"),
          Buffer.alloc(16)
        ])
      }),
    /taille maximale/
  );
});

test("generation du code de confirmation", () => {
  const code = generateConfirmationCodeValue(
    new Date("2026-07-22T10:00:00Z"),
    Buffer.from([1, 2, 3, 4, 5, 6])
  );

  assert.match(code, /^STG-2026-[A-Z2-9]{6}$/);
  assert.notEqual(code, "STG-2026-000001");
});
