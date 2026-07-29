import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocumentFromPdf,
  formatDocumensoError,
  getDocumensoDiagnostic,
  getDocumensoConfigMessage,
  isDocumensoDocumentLimitError,
  isDocumensoConfigured
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
