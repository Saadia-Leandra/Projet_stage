import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDocumensoWebhookEvent,
  verifyDocumensoWebhookSecret
} from "../services/contractService.js";

test("verifie le secret webhook Documenso", () => {
  const previousSecret =
    process.env.DOCUMENSO_WEBHOOK_SECRET;
  process.env.DOCUMENSO_WEBHOOK_SECRET = "secret-test";

  const validRequest = {
    get(name) {
      return name.toLowerCase() ===
        "x-documenso-secret"
        ? "secret-test"
        : "";
    }
  };

  const invalidRequest = {
    get(name) {
      return name.toLowerCase() ===
        "x-documenso-secret"
        ? "bad-secret"
        : "";
    }
  };

  assert.equal(
    verifyDocumensoWebhookSecret(validRequest),
    true
  );
  assert.equal(
    verifyDocumensoWebhookSecret(invalidRequest),
    false
  );

  if (previousSecret) {
    process.env.DOCUMENSO_WEBHOOK_SECRET =
      previousSecret;
  } else {
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  }
});

test("normalise un evenement webhook Documenso", () => {
  const body = {
    event: "DOCUMENT_SIGNED",
    payload: {
      id: "envelope_123",
      externalId: "stagetec-contract-123",
      recipients: [
        {
          id: "recipient_1",
          email: "milieu@example.com",
          signingOrder: 1,
          signingStatus: "SIGNED",
          signedAt: "2026-07-21T12:00:00Z"
        }
      ]
    }
  };

  const first = normalizeDocumensoWebhookEvent(body);
  const second = normalizeDocumensoWebhookEvent(body);

  assert.equal(first.type, "DOCUMENT_SIGNED");
  assert.equal(first.documentId, "envelope_123");
  assert.equal(first.externalId, "stagetec-contract-123");
  assert.equal(first.recipients[0].id, "recipient_1");
  assert.equal(first.eventKey, second.eventKey);
});
