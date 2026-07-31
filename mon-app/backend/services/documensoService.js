import "../config/env.js";
import { promises as fs } from "node:fs";
import path from "node:path";

import { assertValidPdf } from "./contractPdfService.js";

const defaultApiUrl = "https://app.documenso.com/api/v2";
const documentLimitCode = "DOCUMENSO_DOCUMENT_LIMIT";
const documentLimitMessage =
  "La limite mensuelle de documents Documenso est atteinte. Augmentez le forfait Documenso ou attendez le prochain cycle, puis relancez l'envoi pour signature.";

export function isDocumensoConfigured() {
  return Boolean(getDocumensoApiKey());
}

export async function createAndSendDocument({
  pdfPath,
  title,
  externalId,
  recipients
}) {
  const createdDocument = await createDocumentFromPdf({
    pdfPath,
    title,
    externalId,
    recipients
  });

  const recipientsWithIds = mergeRecipientIds(
    recipients,
    extractRecipients(createdDocument.raw)
  );

  const distributedDocument =
    await sendDocumentForSignature(
      createdDocument.envelopeId
    );
  const envelope = await getEnvelope(
    createdDocument.envelopeId
  ).catch(() => ({}));

  return {
    envelopeId: createdDocument.envelopeId,
    documentItemId: readFirstValue(
      createdDocument.documentItemId,
      extractDocumentItemId(distributedDocument),
      extractDocumentItemId(envelope)
    ),
    status:
      readStatus(distributedDocument) ||
      readStatus(envelope) ||
      "PENDING",
    recipients: mergeRecipientIds(
      recipientsWithIds,
      extractRecipients(distributedDocument),
      extractRecipients(envelope),
      extractRecipients(createdDocument.raw)
    )
  };
}

export async function createDocumentFromPdf({
  pdfPath,
  title,
  externalId,
  recipients = []
}) {
  ensureConfigured();
  await assertValidPdf(pdfPath);

  const fileBuffer = await fs.readFile(pdfPath);
  const payload = {
    title,
    externalId,
    visibility: "EVERYONE",
    type: "DOCUMENT",
    meta: {
      signingOrder: "SEQUENTIAL"
    }
  };

  if (recipients.length) {
    payload.recipients = recipients.map(
      (recipient, index) => ({
        name: recipient.name,
        email: recipient.email,
        role: "SIGNER",
        signingOrder: recipient.signingOrder,
        fields: [
          createSignatureFieldPayload(
            recipient,
            index
          )
        ]
      })
    );
  }

  const formData = new FormData();
  formData.append("payload", JSON.stringify(payload));
  formData.append(
    "files",
    new Blob([fileBuffer], {
      type: "application/pdf"
    }),
    path.basename(pdfPath)
  );

  const response = await documensoRequest(
    "/envelope/create",
    {
      method: "POST",
      formData
    }
  );

  const envelopeId = readFirstValue(
    response?.id,
    response?.envelopeId,
    response?.envelope?.id,
    response?.data?.id,
    response?.data?.envelopeId
  );

  if (!envelopeId) {
    throw createError(
      "Documenso n'a pas retourne d'identifiant de document.",
      502
    );
  }

  return {
    raw: response,
    envelopeId: String(envelopeId),
    documentItemId: readFirstValue(
      response?.documentId,
      response?.document?.id,
      response?.documents?.[0]?.id,
      response?.envelopeItems?.[0]?.id,
      response?.items?.[0]?.id,
      response?.data?.documentId,
      response?.data?.documents?.[0]?.id,
      response?.data?.envelopeItems?.[0]?.id,
      response?.data?.items?.[0]?.id,
      extractDocumentItemId(response)
    )
  };
}

export async function addRecipients({
  envelopeId,
  recipients
}) {
  ensureConfigured();

  const response = await documensoRequest(
    "/envelope/recipient/create-many",
    {
      method: "POST",
      json: {
        envelopeId,
        data: recipients.map((recipient) => ({
          name: recipient.name,
          email: recipient.email,
          role: "SIGNER",
          signingOrder: recipient.signingOrder
        }))
      }
    }
  );

  return extractRecipients(response);
}

export async function addSignatureFields({
  documentId,
  recipients
}) {
  ensureConfigured();

  const fields = recipients.map((recipient, index) => {
    const position =
      signatureFieldPositionByRole(recipient.role) ||
      fallbackSignatureFieldPosition(index);

    return {
      documentId,
      recipientId: recipient.documensoRecipientId,
      type: "SIGNATURE",
      pageNumber: position.page,
      pageX: position.positionX,
      pageY: position.positionY,
      page: position.page,
      positionX: position.positionX,
      positionY: position.positionY,
      width: position.width,
      height: position.height
    };
  });

  const response = await documensoRequest(
    "/envelope/field/create-many",
    {
      method: "POST",
      json: {
        documentId,
        fields
      }
    }
  );

  return response;
}

function signatureFieldPositionByRole(role) {
  const positions = {
    ETUDIANT: {
      page: 3,
      positionX: 4,
      positionY: 1.2,
      width: 31,
      height: 4.6
    },
    ENTREPRISE: {
      page: 3,
      positionX: 4,
      positionY: 7.7,
      width: 31,
      height: 4.6
    },
    SUPERVISEUR: {
      page: 3,
      positionX: 52,
      positionY: 1.2,
      width: 31,
      height: 4.6
    },
    CONSEILLERE: {
      page: 3,
      positionX: 52,
      positionY: 13.2,
      width: 31,
      height: 4.2
    },
    DIRECTION: {
      page: 3,
      positionX: 52,
      positionY: 7.7,
      width: 31,
      height: 4.6
    }
  };

  return positions[role] || null;
}

function fallbackSignatureFieldPosition(index) {
  return {
    page: 1,
    positionX: 12,
    positionY: 68 + index * 7,
    width: 34,
    height: 6
  };
}

function createSignatureFieldPayload(recipient, index) {
  const position =
    signatureFieldPositionByRole(recipient.role) ||
    fallbackSignatureFieldPosition(index);

  return {
    identifier: 0,
    type: "SIGNATURE",
    pageNumber: position.page,
    pageX: position.positionX,
    pageY: position.positionY,
    page: position.page,
    positionX: position.positionX,
    positionY: position.positionY,
    width: position.width,
    height: position.height,
    fieldMeta: {
      type: "signature",
      required: true
    }
  };
}

export async function sendDocumentForSignature(
  envelopeId
) {
  ensureConfigured();

  return documensoRequest("/envelope/distribute", {
    method: "POST",
    json: {
      envelopeId
    }
  });
}

export async function getDocumentStatus(envelopeId) {
  ensureConfigured();

  const response = await getEnvelope(envelopeId);

  return {
    raw: response,
    status: readStatus(response),
    recipients: extractRecipients(response)
  };
}

export async function getDocumensoDiagnostic() {
  if (!isDocumensoConfigured()) {
    return {
      configured: false,
      status: "non_configure",
      message: getDocumensoConfigMessage()
    };
  }

  try {
    await documensoRequest("/envelope?page=1&perPage=1", {
      method: "GET"
    });

    return {
      configured: true,
      status: "connexion_reussie",
      message: "Connexion Documenso reussie."
    };
  } catch (error) {
    return {
      configured: true,
      status: "connexion_echouee",
      message: error.message
    };
  }
}

export async function downloadSignedPdf(envelopeId) {
  ensureConfigured();

  return documensoRequest(
    `/envelope/item/${encodeURIComponent(envelopeId)}/download?version=signed`,
    {
      method: "GET",
      binary: true
    }
  );
}

async function getEnvelope(envelopeId) {
  return documensoRequest(
    `/envelope/${encodeURIComponent(envelopeId)}`,
    {
      method: "GET"
    }
  );
}

export function getDocumensoConfigMessage() {
  if (isDocumensoConfigured()) {
    return "";
  }

  return "La signature electronique Documenso n'est pas configuree.";
}

async function documensoRequest(
  apiPath,
  { method, json, formData, binary = false }
) {
  const apiUrl = getDocumensoApiUrl();
  const response = await fetch(`${apiUrl}${apiPath}`, {
    method,
    headers: createHeaders(Boolean(json)),
    body: json
      ? JSON.stringify(json)
      : formData || undefined
  });

  if (!response.ok) {
    throw await createDocumensoError(response);
  }

  if (binary) {
    return Buffer.from(await response.arrayBuffer());
  }

  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function createHeaders(hasJsonBody) {
  const headers = {
    Authorization: getDocumensoApiKey()
  };

  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function createDocumensoError(response) {
  const text = await response.text().catch(() => "");
  let message = text;

  try {
    const data = JSON.parse(text);
    message =
      data.message ||
      data.error ||
      data.errors?.[0]?.message ||
      text;
  } catch {
    // Keep the text body when Documenso does not return JSON.
  }

  return formatDocumensoError(
    message || response.statusText,
    response.status
  );
}

export function formatDocumensoError(message, providerStatus) {
  const cleanMessage = String(message || "").trim();

  if (isDocumensoDocumentLimitError(cleanMessage)) {
    const error = createError(documentLimitMessage, 429);
    error.code = documentLimitCode;
    error.providerStatus = providerStatus;
    return error;
  }

  const error = createError(
    `Erreur Documenso (${providerStatus}): ${
      cleanMessage || "reponse invalide"
    }`,
    502
  );
  error.code = "DOCUMENSO_ERROR";
  error.providerStatus = providerStatus;
  return error;
}

export function isDocumensoDocumentLimitError(message) {
  const normalizedMessage = String(message || "")
    .toLowerCase()
    .replace(/\s+/g, " ");

  return (
    normalizedMessage.includes("document limit") ||
    normalizedMessage.includes(
      "reached your document limit"
    ) ||
    (
      normalizedMessage.includes("upgrade your plan") &&
      normalizedMessage.includes("limit")
    )
  );
}

function mergeRecipientIds(
  localRecipients,
  ...remoteRecipientLists
) {
  return localRecipients.map((localRecipient, index) => {
    const remoteRecipient = remoteRecipientLists
      .flat()
      .find((candidate) => {
        return (
          sameEmail(
            candidate.email,
            localRecipient.email
          ) ||
          Number(candidate.signingOrder) ===
            Number(localRecipient.signingOrder) ||
          index === candidate.index
        );
      });

    return {
      ...localRecipient,
      documensoRecipientId:
        readFirstValue(
          remoteRecipient?.documensoRecipientId,
          remoteRecipient?.id,
          remoteRecipient?.recipientId
        ) || localRecipient.documensoRecipientId,
      signingUrl:
        readFirstValue(
          remoteRecipient?.signingUrl,
          remoteRecipient?.signing_url,
          remoteRecipient?.url,
          remoteRecipient?.token
            ? makeSigningUrl(remoteRecipient.token)
            : ""
        ) || localRecipient.signingUrl
    };
  });
}

function extractRecipients(response) {
  const recipients = readFirstValue(
    Array.isArray(response) ? response : undefined,
    Array.isArray(response?.data) ? response.data : undefined,
    response?.recipients,
    response?.data?.recipients,
    response?.envelope?.recipients,
    response?.document?.recipients,
    response?.payload?.recipients,
    response?.payload?.Recipient,
    response?.Recipient
  );

  if (!Array.isArray(recipients)) {
    return [];
  }

  return recipients.map((recipient, index) => ({
    ...recipient,
    index,
    documensoRecipientId: readFirstValue(
      recipient.id,
      recipient.recipientId,
      recipient.recipient_id
    ),
    signingOrder: readFirstValue(
      recipient.signingOrder,
      recipient.signing_order,
      recipient.order
    ),
    signingUrl: readFirstValue(
      recipient.signingUrl,
      recipient.signing_url,
      recipient.url,
      recipient.token
        ? makeSigningUrl(recipient.token)
        : ""
    )
  }));
}

function extractDocumentItemId(response) {
  return readFirstValue(
    response?.documentItemId,
    response?.envelopeItemId,
    response?.documentId,
    response?.envelopeItems?.[0]?.id,
    response?.items?.[0]?.id,
    response?.documents?.[0]?.id,
    response?.data?.documentItemId,
    response?.data?.envelopeItemId,
    response?.data?.documentId,
    response?.data?.envelopeItems?.[0]?.id,
    response?.data?.items?.[0]?.id,
    response?.data?.documents?.[0]?.id,
    response?.envelope?.envelopeItems?.[0]?.id,
    response?.document?.envelopeItems?.[0]?.id
  );
}

function makeSigningUrl(token) {
  try {
    const baseUrl = new URL(getDocumensoApiUrl());
    return `${baseUrl.origin}/sign/${encodeURIComponent(
      token
    )}`;
  } catch {
    return "";
  }
}

function readStatus(response) {
  return readFirstValue(
    response?.status,
    response?.data?.status,
    response?.envelope?.status,
    response?.document?.status
  );
}

function readFirstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function sameEmail(left, right) {
  return String(left || "").toLowerCase() ===
    String(right || "").toLowerCase();
}

function getDocumensoApiUrl() {
  return String(
    process.env.DOCUMENSO_API_URL || defaultApiUrl
  ).replace(/\/+$/, "");
}

function getDocumensoApiKey() {
  return String(process.env.DOCUMENSO_API_KEY || "").trim();
}

function ensureConfigured() {
  if (!isDocumensoConfigured()) {
    throw createError(
      getDocumensoConfigMessage(),
      503
    );
  }
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}
