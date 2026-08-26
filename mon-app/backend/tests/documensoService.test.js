import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocumentFromPdf,
  formatDocumensoError,
  getDocumensoDiagnostic,
  getDocumensoConfigMessage,
  isDocumensoDocumentLimitError,
  isDocumensoConfigured,
  signatureFieldPositionByRole
} from "../services/documensoService.js";

test("fonctionne sans cle Documenso configuree", async () => {
  const previousApiKey = process.env.DOCUMENSO_API_KEY;
  delete process.env.DOCUMENSO_API_KEY;

  assert.equal(isDocumensoConfigured(), false);
  assert.match(
    getDocumensoConfigMessage(),
    /Documenso n'est pas configuree/
  );

  await assert.rejects(
    () =>
      createDocumentFromPdf({
        pdfPath: "missing.pdf",
        title: "Contrat",
        externalId: "contract-test"
      }),
    /Documenso n'est pas configuree/
  );

  if (previousApiKey) {
    process.env.DOCUMENSO_API_KEY = previousApiKey;
  }
});

test("diagnostic Documenso non configure", async () => {
  const previousApiKey = process.env.DOCUMENSO_API_KEY;
  delete process.env.DOCUMENSO_API_KEY;

  const diagnostic = await getDocumensoDiagnostic();

  assert.equal(diagnostic.configured, false);
  assert.equal(diagnostic.status, "non_configure");

  if (previousApiKey) {
    process.env.DOCUMENSO_API_KEY = previousApiKey;
  }
});

test("traduit la limite mensuelle Documenso", () => {
  const message =
    "You have reached your document limit for this month. Please upgrade your plan.";
  const error = formatDocumensoError(message, 400);

  assert.equal(
    isDocumensoDocumentLimitError(message),
    true
  );
  assert.equal(error.status, 429);
  assert.equal(
    error.code,
    "DOCUMENSO_DOCUMENT_LIMIT"
  );
  assert.match(error.message, /limite mensuelle/);
  assert.doesNotMatch(error.message, /upgrade your plan/i);
});

test("mappe les signatures pedagogique et administration aux bons roles", () => {
  assert.deepEqual(
    signatureFieldPositionByRole("SUPERVISEUR"),
    {
      zone: "APPROBATION_PEDAGOGIQUE",
      page: 3,
      positionX: 52,
      positionY: 0.7,
      width: 28,
      height: 3.2
    }
  );
  assert.deepEqual(
    signatureFieldPositionByRole("CONSEILLERE"),
    {
      zone: "APPROBATION_ADMINISTRATION",
      page: 2,
      positionX: 86,
      positionY: 9.5,
      width: 10,
      height: 3.4
    }
  );
  assert.deepEqual(
    signatureFieldPositionByRole("DIRECTION"),
    {
      zone: "DIRECTION_PROGRAMME",
      page: 3,
      positionX: 52,
      positionY: 6.8,
      width: 28,
      height: 3.2
    }
  );
});
