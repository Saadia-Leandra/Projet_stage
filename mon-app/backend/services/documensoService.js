import { promises as fs } from "node:fs";
import path from "node:path";

import { assertValidPdf } from "./contractPdfService.js";

const defaultApiUrl = "https://app.documenso.com/api/v2";

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
    externalId
  });

  const createdRecipients = await addRecipients({
    envelopeId: createdDocument.envelopeId,
    recipients
  });

  const recipientsWithIds = mergeRecipientIds(
    recipients,
    createdRecipients
  );

  if (
    recipientsWithIds.some(
      (recipient) => !recipient.documensoRecipientId
    )
  ) {
    throw createError(
      "Documenso n'a pas retourne tous les identifiants de destinataires.",
      502
    );
  }

  await addSignatureFields({
    documentId:
      createdDocument.documentItemId ||
      createdDocument.envelopeId,
    recipients: recipientsWithIds
  });

  const distributedDocument =
    await sendDocumentForSignature(
      createdDocument.envelopeId
    );

  return {
    envelopeId: createdDocument.envelopeId,
    documentItemId: createdDocument.documentItemId,
    status: readStatus(distributedDocument) || "PENDING",
    recipients: mergeRecipientIds(
      recipientsWithIds,
      extractRecipients(distributedDocument),
      createdRecipients
    )
  };
}

export async function createDocumentFromPdf({
  pdfPath,
  title,
  externalId
}) {
  ensureConfigured();
  await assertValidPdf(pdfPath);

  const fileBuffer = await fs.readFile(pdfPath);
  const payload = {
    title,
    externalId,
    visibility: "EVERYONE",
    type: "DOCUMENT",
    signingOrder: "SEQUENTIAL"
  };

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
      response?.data?.items?.[0]?.id
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
        data: fields,
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
      positionY: 5,
      width: 28,
      height: 6
    },
    ENTREPRISE: {
      page: 3,
      positionX: 4,
      positionY: 11,
      width: 28,
      height: 6
    },
    SUPERVISEUR: {
      page: 3,
      positionX: 52,
      positionY: 5,
      width: 28,
      height: 6
    },
    CONSEILLERE: {
      page: 1,
      positionX: 34,
      positionY: 9,
      width: 20,
      height: 6
    },
    DIRECTION: {
      page: 3,
      positionX: 52,
      positionY: 11,
      width: 28,
      height: 6
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

  const response = await documensoRequest(
    `/envelope/get/${encodeURIComponent(envelopeId)}`,
    {
      method: "GET"
    }
  );

  return {
    raw: response,
    status: readStatus(response),
    recipients: extractRecipients(response)
  };
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

  return createError(
    `Erreur Documenso (${response.status}): ${
      message || response.statusText
    }`,
    502
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
          remoteRecipient?.url
        ) || localRecipient.signingUrl
    };
  });
}

function extractRecipients(response) {
  const recipients = readFirstValue(
    response?.recipients,
    response?.data?.recipients,
    response?.envelope?.recipients,
    response?.document?.recipients
  );

  if (!Array.isArray(recipients)) {
    return [];
  }

  return recipients.map((recipient, index) => ({
    ...recipient,
    index,
    documensoRecipientId: readFirstValue(
      recipient.id,
      recipient.recipientId
    ),
    signingOrder: readFirstValue(
      recipient.signingOrder,
      recipient.order
    ),
    signingUrl: readFirstValue(
      recipient.signingUrl,
      recipient.signing_url,
      recipient.url
    )
  }));
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
