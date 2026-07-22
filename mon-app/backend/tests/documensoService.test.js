import assert from "node:assert/strict";
import test from "node:test";

import {
  createDocumentFromPdf,
  getDocumensoConfigMessage,
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
