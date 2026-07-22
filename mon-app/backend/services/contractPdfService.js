import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const contractStorageRoot = path.resolve(
  __dirname,
  "..",
  "storage",
  "contracts"
);

export async function generateContractPdf(
  contract,
  signers
) {
  const fileName = makePdfFileName(contract, "original");
  const relativePath = path.join("original", fileName);
  const absolutePath =
    resolveContractStoragePath(relativePath);

  await fs.mkdir(path.dirname(absolutePath), {
    recursive: true
  });

  const pdfBuffer = createPdfBuffer(
    buildContractPdfPages(contract, signers)
  );

  await fs.writeFile(absolutePath, pdfBuffer);
  await assertValidPdf(absolutePath);

  return {
    fileName,
    relativePath: normalizeStoragePath(relativePath),
    absolutePath
  };
}

export async function saveSignedContractPdf(
  contract,
  pdfBuffer
) {
  if (!isPdfBuffer(pdfBuffer)) {
    throw createError(
      "Le document signe retourne par Documenso n'est pas un PDF valide.",
      502
    );
  }

  const fileName = makePdfFileName(contract, "signed");
  const relativePath = path.join("signed", fileName);
  const absolutePath =
    resolveContractStoragePath(relativePath);

  await fs.mkdir(path.dirname(absolutePath), {
    recursive: true
  });

  await fs.writeFile(absolutePath, pdfBuffer);
  await assertValidPdf(absolutePath);

  return {
    fileName,
    relativePath: normalizeStoragePath(relativePath),
    absolutePath
  };
}

export function resolveContractStoragePath(relativePath) {
  const cleanPath = String(relativePath || "");

  if (
    path.isAbsolute(cleanPath) ||
    cleanPath.includes("..")
  ) {
    throw createError("Chemin de fichier invalide.", 400);
  }

  const absolutePath = path.resolve(
    contractStorageRoot,
    cleanPath
  );

  const rootWithSeparator =
    contractStorageRoot.endsWith(path.sep)
      ? contractStorageRoot
      : `${contractStorageRoot}${path.sep}`;

  if (
    absolutePath !== contractStorageRoot &&
    !absolutePath.startsWith(rootWithSeparator)
  ) {
    throw createError("Chemin de fichier invalide.", 400);
  }

  return absolutePath;
}

export async function assertValidPdf(filePath) {
  const handle = await fs.open(filePath, "r");

  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);

    if (!isPdfBuffer(buffer)) {
      throw createError(
        "Le fichier genere n'est pas un PDF valide.",
        500
      );
    }
  } finally {
    await handle.close();
  }
}

function buildContractPdfPages(contract, signers) {
  const studentName = [
    contract.studentFirstName,
    contract.studentLastName
  ]
    .filter(Boolean)
    .join(" ");

  const teacherName = [
    contract.teacherFirstName,
    contract.teacherLastName
  ]
    .filter(Boolean)
    .join(" ");

  const firstPage = [
    "CONTRAT DE STAGE - StageTec",
    "",
    `Reference: ${contract.externalId || contract.id}`,
    `Etudiant: ${studentName || "-"}`,
    `Code etudiant: ${contract.studentCode || "-"}`,
    `Programme: ${contract.codeProgram || contract.program || "-"}`,
    `Session: ${contract.session || "-"}`,
    `Annee scolaire: ${contract.schoolYear || "-"}`,
    "",
    `Milieu de stage: ${contract.companyName || "-"}`,
    `Adresse: ${formatAddress(contract)}`,
    `Superviseur en entreprise: ${contract.companySupervisorName || "-"}`,
    `Courriel: ${contract.companySupervisorEmail || "-"}`,
    "",
    `Enseignant: ${teacherName || "-"}`,
    "",
    `Periode: ${formatDate(contract.startDate)} au ${formatDate(contract.endDate)}`,
    `Horaire: ${contract.workSchedule || "-"}`,
    `Type d'horaire: ${scheduleTypeLabel(contract.scheduleType)}`,
    `Heures par semaine: ${displayNumber(contract.hoursPerWeek)}`,
    `Nombre de semaines: ${displayNumber(contract.numberOfWeeks)}`,
    `Total d'heures: ${displayNumber(contract.totalHours)}`,
    "",
    "Fonction de stage:",
    contract.functionStage || "-",
    "",
    "Description du stage:",
    contract.descriptionStage || contract.taskSummary || "-"
  ];

  const secondPage = [
    "REMUNERATION ET SIGNATURES",
    "",
    `Stage remunere: ${contract.isPaid ? "Oui" : "Non"}`,
    `Salaire horaire: ${contract.isPaid ? displayMoney(contract.hourlySalary) : "-"}`,
    `Compensation monetaire: ${contract.monetaryCompensation || "-"}`,
    `Autre compensation: ${contract.otherCompensation || "-"}`,
    "",
    "Signataires Documenso dans l'ordre:",
    ...signers.flatMap((signer) => [
      "",
      `${signer.signingOrder}. ${signerRoleLabel(signer.role)}`,
      `Nom: ${signer.name || "-"}`,
      `Courriel: ${signer.email || "-"}`,
      "Signature: ________________________________",
      "Date: ____________________"
    ])
  ];

  return [firstPage, secondPage];
}

function createPdfBuffer(pages) {
  const pageCount = pages.length;
  const fontObjectId = 3;
  const objects = [];
  const pageObjectIds = [];
  const contentObjectIds = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

  for (let index = 0; index < pageCount; index += 1) {
    pageObjectIds.push(4 + index * 2);
    contentObjectIds.push(5 + index * 2);
  }

  objects[2] =
    `<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageCount} >>`;

  objects[fontObjectId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const pageObjectId = pageObjectIds[index];
    const contentObjectId = contentObjectIds[index];
    const content = createPageContent(pageLines);

    objects[pageObjectId] = [
      "<<",
      "/Type /Page",
      "/Parent 2 0 R",
      "/MediaBox [0 0 612 792]",
      "/Resources << /Font << /F1 3 0 R >> >>",
      `/Contents ${contentObjectId} 0 R`,
      ">>"
    ].join("\n");

    objects[contentObjectId] = [
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>`,
      "stream",
      content,
      "endstream"
    ].join("\n");
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");

  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += [
    "trailer",
    `<< /Size ${objects.length} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");

  return Buffer.from(pdf, "utf8");
}

function createPageContent(lines) {
  const content = [
    "BT",
    "/F1 16 Tf",
    "72 740 Td",
    `(${escapePdfText(lines[0] || "")}) Tj`,
    "/F1 10 Tf"
  ];

  const wrappedLines = lines
    .slice(1)
    .flatMap((line) => wrapLine(line, 92));

  wrappedLines.forEach((line) => {
    content.push("0 -16 Td");
    content.push(`(${escapePdfText(line)}) Tj`);
  });

  content.push("ET");

  return content.join("\n");
}

function wrapLine(value, maxLength) {
  const text = toPdfText(value);

  if (!text) {
    return [""];
  }

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = nextLine;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function makePdfFileName(contract, suffix) {
  const idPart = String(
    contract.externalId || `contrat-${contract.id}`
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);

  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);

  const randomPart = crypto
    .randomBytes(4)
    .toString("hex");

  return `${idPart}-${suffix}-${timestamp}-${randomPart}.pdf`;
}

function normalizeStoragePath(value) {
  return value.split(path.sep).join("/");
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) &&
    buffer.slice(0, 5).toString("ascii") === "%PDF-";
}

function escapePdfText(value) {
  return toPdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function toPdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAddress(contract) {
  return [
    contract.companyAddress,
    contract.companyCity,
    contract.companyPostalCode
  ]
    .filter(Boolean)
    .join(", ") || "-";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return String(value).slice(0, 10);
}

function scheduleTypeLabel(value) {
  const labels = {
    TEMPS_PARTIEL: "Temps partiel",
    TEMPS_PLEIN: "Temps plein"
  };

  return labels[value] || "-";
}

function signerRoleLabel(value) {
  const labels = {
    ENTREPRISE: "Milieu de stage",
    SUPERVISEUR: "Enseignant",
    CONSEILLERE: "Conseillere",
    DIRECTION: "Direction"
  };

  return labels[value] || value || "-";
}

function displayNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return String(numberValue);
}

function displayMoney(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return `${numberValue.toFixed(2)} CAD`;
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}
