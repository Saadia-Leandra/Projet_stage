import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PDFDocument,
  StandardFonts,
  rgb
} from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const contractStorageRoot = path.resolve(
  __dirname,
  "..",
  "storage",
  "contracts"
);

const stageTemplateRoot = path.resolve(
  __dirname,
  "..",
  "templates",
  "stage"
);

const contractTemplatePath = path.join(
  stageTemplateRoot,
  "contrat-stage-officiel.pdf"
);

const requestTemplatePath = path.join(
  stageTemplateRoot,
  "demande-stage-officielle.pdf"
);

export async function generateContractPdf(
  contract,
  _signers = []
) {
  const fileName = makePdfFileName(
    contract,
    "contrat-original"
  );
  const relativePath = path.join("original", fileName);
  const absolutePath =
    resolveContractStoragePath(relativePath);

  const pdfBuffer = await fillTemplatePdf(
    contractTemplatePath,
    (pdfDoc, font) => {
      drawContractValues(pdfDoc, font, contract);
    }
  );

  await savePdfBuffer(absolutePath, pdfBuffer);

  return {
    fileName,
    relativePath: normalizeStoragePath(relativePath),
    absolutePath
  };
}

export async function generateInternshipRequestPdf(
  request
) {
  const fileName = makePdfFileName(
    {
      id: request.id,
      externalId: `demande-stage-${request.id}`
    },
    "demande"
  );
  const relativePath = path.join("requests", fileName);
  const absolutePath =
    resolveContractStoragePath(relativePath);

  const pdfBuffer = await fillTemplatePdf(
    requestTemplatePath,
    (pdfDoc, font) => {
      drawRequestValues(pdfDoc, font, request);
    }
  );

  await savePdfBuffer(absolutePath, pdfBuffer);

  return {
    fileName,
    relativePath: normalizeStoragePath(relativePath),
    absolutePath
  };
}

export async function saveSignedContractPdf(
  contract,
  pdfBuffer,
  {
    signers = [],
    includeAttestation = false
  } = {}
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
  const signedBuffer =
    signers.length || includeAttestation
      ? await stampContractSignaturesOnPdf(
          pdfBuffer,
          {
            contract,
            signers,
            includeAttestation
          }
        )
      : pdfBuffer;

  await savePdfBuffer(absolutePath, signedBuffer);

  return {
    fileName,
    relativePath: normalizeStoragePath(relativePath),
    absolutePath
  };
}

export async function stampContractSignaturesOnPdf(
  pdfBuffer,
  {
    contract = {},
    signers = [],
    includeAttestation = false
  } = {}
) {
  if (!isPdfBuffer(pdfBuffer)) {
    throw createError(
      "Le document signe retourne par Documenso n'est pas un PDF valide.",
      502
    );
  }

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(
    StandardFonts.Helvetica
  );
  const boldFont = await pdfDoc.embedFont(
    StandardFonts.HelveticaBold
  );
  const fonts = { font, boldFont };
  const normalizedSigners =
    normalizeContractSigners(signers);
  const signedSigners = normalizedSigners.filter(
    (signer) => signer.status === "SIGNE"
  );

  drawOfficialSignatureStamps(
    pdfDoc,
    fonts,
    signedSigners
  );

  if (includeAttestation) {
    drawSignatureAttestationPage(
      pdfDoc,
      fonts,
      contract,
      normalizedSigners
    );
  }

  return Buffer.from(await pdfDoc.save());
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
  let handle;

  try {
    handle = await fs.open(filePath, "r");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw createError(
        "Le fichier PDF demandé est introuvable sur le serveur.",
        404
      );
    }

    throw error;
  }

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

async function fillTemplatePdf(
  templatePath,
  drawValues
) {
  const templateBytes = await fs.readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(
    StandardFonts.Helvetica
  );

  drawValues(pdfDoc, font);

  return Buffer.from(await pdfDoc.save());
}

async function savePdfBuffer(absolutePath, pdfBuffer) {
  await fs.mkdir(path.dirname(absolutePath), {
    recursive: true
  });

  await fs.writeFile(absolutePath, pdfBuffer);
  await assertValidPdf(absolutePath);
}

const signerRoleOrder = [
  "ETUDIANT",
  "ENTREPRISE",
  "SUPERVISEUR",
  "CONSEILLERE",
  "DIRECTION"
];

const officialSignatureStampPositions = {
  ETUDIANT: {
    pageIndex: 2,
    x: 28,
    y: 764,
    width: 160,
    height: 22,
    dateX: 190,
    dateWidth: 70
  },
  SUPERVISEUR: {
    pageIndex: 2,
    x: 318,
    y: 764,
    width: 176,
    height: 22,
    dateX: 500,
    dateWidth: 70
  },
  ENTREPRISE: {
    pageIndex: 2,
    x: 28,
    y: 712,
    width: 160,
    height: 22,
    dateX: 190,
    dateWidth: 70
  },
  DIRECTION: {
    pageIndex: 2,
    x: 318,
    y: 712,
    width: 176,
    height: 22,
    dateX: 500,
    dateWidth: 70
  }
};

function drawOfficialSignatureStamps(
  pdfDoc,
  fonts,
  signers
) {
  const pages = pdfDoc.getPages();

  signers.forEach((signer) => {
    const position =
      officialSignatureStampPositions[signer.role];

    if (!position || !pages[position.pageIndex]) {
      return;
    }

    drawOfficialSignatureStamp(
      pages[position.pageIndex],
      fonts,
      signer,
      position
    );
  });
}

function drawOfficialSignatureStamp(
  page,
  fonts,
  signer,
  position
) {
  const signedDate = formatDateTimeForPdf(
    signer.signedAt
  );

  page.drawRectangle({
    x: position.x,
    y: position.y,
    width: position.width,
    height: position.height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.08, 0.24, 0.48),
    borderWidth: 0.6
  });

  drawValue(
    page,
    fonts.boldFont,
    signer.name || signer.email || signerRolePdfLabel(signer.role),
    position.x + 4,
    position.y + 11,
    {
      maxWidth: position.width - 8,
      size: 7,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.font,
    `${signerRolePdfLabel(signer.role)} - ${signatureProviderLabel(signer)}`,
    position.x + 4,
    position.y + 3,
    {
      maxWidth: position.width - 8,
      size: 5.8,
      verticalOffset: 0
    }
  );

  page.drawRectangle({
    x: position.dateX,
    y: position.y,
    width: position.dateWidth,
    height: position.height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.08, 0.24, 0.48),
    borderWidth: 0.6
  });
  drawValue(
    page,
    fonts.font,
    signedDate,
    position.dateX + 4,
    position.y + 8,
    {
      maxWidth: position.dateWidth - 8,
      size: 6,
      verticalOffset: 0
    }
  );
}

function drawSignatureAttestationPage(
  pdfDoc,
  fonts,
  contract,
  signers
) {
  const page = pdfDoc.addPage([612, 792]);
  const signedAt = formatDateTimeForPdf(
    contract.completedAt || contract.completeAt || new Date()
  );
  const confirmationCode =
    contract.confirmationCode || "";

  page.drawRectangle({
    x: 0,
    y: 0,
    width: 612,
    height: 792,
    color: rgb(0.98, 0.99, 1)
  });

  drawValue(
    page,
    fonts.boldFont,
    "Attestation des signatures StageTec",
    48,
    720,
    {
      maxWidth: 420,
      size: 18,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.font,
    "Cette page confirme les signatures recueillies pour le contrat de stage.",
    48,
    698,
    {
      maxWidth: 490,
      size: 10,
      verticalOffset: 0
    }
  );

  drawAttestationMeta(page, fonts, contract, signedAt);

  const signersByRole = new Map(
    signers.map((signer) => [signer.role, signer])
  );

  signerRoleOrder.forEach((role, index) => {
    drawAttestationSignerRow(
      page,
      fonts,
      role,
      signersByRole.get(role),
      640 - index * 74
    );
  });

  drawValue(
    page,
    fonts.boldFont,
    "Code de confirmation",
    48,
    132,
    {
      maxWidth: 220,
      size: 11,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.font,
    confirmationCode || "Non attribue",
    48,
    114,
    {
      maxWidth: 220,
      size: 10,
      verticalOffset: 0
    }
  );

  if (confirmationCode) {
    drawConfirmationBarcode(
      page,
      confirmationCode,
      300,
      104
    );
  }
}

function drawAttestationMeta(
  page,
  fonts,
  contract,
  signedAt
) {
  const rows = [
    [
      "Etudiant",
      fullStudentName(contract) || "-"
    ],
    [
      "Entreprise",
      contract.companyName || "-"
    ],
    [
      "Contrat",
      contract.externalId || `Contrat ${contract.id || "-"}`
    ],
    [
      "Dossier complete le",
      signedAt || "-"
    ]
  ];

  rows.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? 48 : 320;
    const y = index < 2 ? 666 : 626;

    drawValue(page, fonts.boldFont, label, x, y, {
      maxWidth: 180,
      size: 7.5,
      verticalOffset: 0
    });
    drawValue(page, fonts.font, value, x, y - 15, {
      maxWidth: 220,
      size: 9,
      verticalOffset: 0
    });
  });
}

function drawAttestationSignerRow(
  page,
  fonts,
  role,
  signer,
  y
) {
  const signed = signer?.status === "SIGNE";
  const statusColor = signed
    ? rgb(0.04, 0.42, 0.28)
    : rgb(0.71, 0.29, 0.03);

  page.drawRectangle({
    x: 48,
    y,
    width: 516,
    height: 56,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.86, 0.9, 0.96),
    borderWidth: 0.8
  });

  drawValue(
    page,
    fonts.boldFont,
    signerRolePdfLabel(role),
    64,
    y + 35,
    {
      maxWidth: 140,
      size: 9,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.font,
    signer?.name || "-",
    210,
    y + 35,
    {
      maxWidth: 210,
      size: 9,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.font,
    signer?.email || "-",
    210,
    y + 20,
    {
      maxWidth: 210,
      size: 7,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.boldFont,
    signerStatusPdfLabel(signer?.status),
    430,
    y + 35,
    {
      maxWidth: 110,
      size: 8,
      verticalOffset: 0
    }
  );
  drawValue(
    page,
    fonts.font,
    signed
      ? formatDateTimeForPdf(signer.signedAt)
      : "En attente",
    430,
    y + 20,
    {
      maxWidth: 110,
      size: 7,
      verticalOffset: 0
    }
  );

  page.drawRectangle({
    x: 64,
    y: y + 12,
    width: 10,
    height: 10,
    color: statusColor
  });
  drawValue(
    page,
    fonts.font,
    signatureProviderLabel(signer),
    80,
    y + 12,
    {
      maxWidth: 160,
      size: 7,
      verticalOffset: 0
    }
  );
}

function drawConfirmationBarcode(
  page,
  value,
  x,
  y
) {
  const bars = Array.from(String(value || ""))
    .flatMap((character) => {
      const code = character.charCodeAt(0);
      return [1, 2, 3].map((offset) => ({
        width: code % (offset + 2) === 0 ? 4 : 2,
        active: (code + offset) % 2 === 0
      }));
    })
    .slice(0, 60);

  let currentX = x;

  bars.forEach((bar) => {
    if (bar.active) {
      page.drawRectangle({
        x: currentX,
        y,
        width: bar.width,
        height: 46,
        color: rgb(0.05, 0.18, 0.34)
      });
    }

    currentX += bar.width + 2;
  });
}

function drawContractValues(pdfDoc, font, contract) {
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const conventionPage = pages[1];

  drawContractCover(firstPage, font, contract);
  drawContractConvention(conventionPage, font, contract);
}

function drawContractCover(page, font, contract) {
  drawValue(page, font, fullStudentName(contract), 250, 619, {
    maxWidth: 320
  });
  drawValue(page, font, contract.studentGroup, 145, 601, {
    maxWidth: 160
  });
  drawValue(page, font, contract.studentEmail, 160, 584, {
    maxWidth: 190
  });
  drawValue(page, font, contract.studentPhone, 395, 584, {
    maxWidth: 150
  });
  drawValue(page, font, contract.program, 240, 554, {
    maxWidth: 300
  });
  drawValue(page, font, dateRange(contract), 235, 522, {
    maxWidth: 270
  });
  drawValue(page, font, contract.workSchedule, 210, 512, {
    maxWidth: 140
  });
  drawValue(
    page,
    font,
    displayNumber(contract.hoursPerWeek),
    500,
    512,
    { maxWidth: 50 }
  );
  drawValue(
    page,
    font,
    contract.descriptionStage || contract.taskSummary,
    95,
    462,
    {
      maxWidth: 410,
      maxLines: 7,
      lineHeight: 10
    }
  );

  drawValue(page, font, contract.companyName, 270, 372, {
    maxWidth: 290
  });
  drawValue(page, font, contract.companyNeq, 130, 357, {
    maxWidth: 160
  });
  drawValue(
    page,
    font,
    contract.companyWebsite,
    370,
    357,
    { maxWidth: 170 }
  );
  drawValue(
    page,
    font,
    firstValue(
      contract.companySignatureName,
      contract.companySupervisorName
    ),
    140,
    340,
    { maxWidth: 230 }
  );
  drawValue(
    page,
    font,
    firstValue(
      contract.companySignatureEmail,
      contract.companySupervisorEmail,
      contract.companyEmail
    ),
    178,
    324,
    { maxWidth: 300 }
  );
  drawValue(page, font, contract.companyAddress, 145, 308, {
    maxWidth: 225
  });
  drawValue(page, font, cityWithProvince(
    contract.companyCity,
    contract.companyProvince
  ), 430, 308, {
    maxWidth: 100
  });
  drawValue(
    page,
    font,
    contract.companyPostalCode,
    160,
    291,
    { maxWidth: 75 }
  );
  drawValue(page, font, contract.companyPhone, 330, 291, {
    maxWidth: 90
  });
  drawValue(
    page,
    font,
    contract.companyPhoneExtension,
    465,
    291,
    { maxWidth: 50 }
  );

  drawValue(
    page,
    font,
    contract.companySupervisorName,
    330,
    255,
    { maxWidth: 260 }
  );
  drawValue(
    page,
    font,
    contract.companySupervisorTitle,
    130,
    238,
    { maxWidth: 265 }
  );
  drawValue(
    page,
    font,
    contract.companySupervisorEmail,
    150,
    222,
    { maxWidth: 210 }
  );
  drawValue(
    page,
    font,
    contract.companySupervisorPhone,
    410,
    222,
    { maxWidth: 130 }
  );
}

function drawContractConvention(page, font, contract) {
  drawValue(page, font, contract.schoolYear, 50, 651, {
    maxWidth: 65,
    size: 8
  });
  drawSessionCheck(page, font, contract.session);

  drawValue(page, font, contract.studentLastName, 24, 619, {
    maxWidth: 200,
    size: 8
  });
  drawValue(page, font, contract.studentFirstName, 248, 619, {
    maxWidth: 190,
    size: 8
  });
  drawValue(
    page,
    font,
    firstValue(contract.codeProgram, contract.program),
    500,
    619,
    { maxWidth: 70, size: 8 }
  );
  drawValue(page, font, contract.studentAddress, 24, 579, {
    maxWidth: 170,
    size: 8
  });
  drawValue(page, font, cityWithProvince(
    contract.studentCity,
    contract.studentProvince
  ), 205, 579, {
    maxWidth: 150,
    size: 8
  });
  drawValue(
    page,
    font,
    contract.studentPostalCode,
    390,
    579,
    { maxWidth: 75, size: 8 }
  );
  drawValue(
    page,
    font,
    contract.codeProgram,
    500,
    579,
    { maxWidth: 70, size: 8 }
  );
  drawValue(page, font, contract.studentPhone, 24, 543, {
    maxWidth: 130,
    size: 8
  });
  drawValue(page, font, contract.studentEmail, 225, 543, {
    maxWidth: 180,
    size: 8
  });
  drawValue(
    page,
    font,
    contract.studentPermanentCode,
    450,
    543,
    { maxWidth: 100, size: 8 }
  );

  drawValue(page, font, contract.companyName, 78, 480, {
    maxWidth: 450,
    size: 8
  });
  drawValue(
    page,
    font,
    contract.companySupervisorName,
    78,
    459,
    { maxWidth: 250, size: 8 }
  );
  drawValue(page, font, contract.companyPhone, 410, 459, {
    maxWidth: 130,
    size: 8
  });
  drawValue(
    page,
    font,
    contract.companySupervisorTitle,
    47,
    424,
    { maxWidth: 265, size: 8 }
  );
  drawValue(
    page,
    font,
    contract.companySupervisorEmail,
    47,
    405,
    { maxWidth: 265, size: 8 }
  );
  drawValue(
    page,
    font,
    contract.companyWebsite,
    382,
    405,
    { maxWidth: 175, size: 8 }
  );
  drawValue(page, font, contract.companyAddress, 61, 385, {
    maxWidth: 300,
    size: 8
  });
  drawValue(page, font, cityWithProvince(
    contract.companyCity,
    contract.companyProvince
  ), 420, 385, {
    maxWidth: 110,
    size: 8
  });
  drawValue(
    page,
    font,
    contract.companyPostalCode,
    75,
    361,
    { maxWidth: 110, size: 8 }
  );
  drawOrganizationCheck(
    page,
    font,
    contract.organizationType
  );
  drawValue(
    page,
    font,
    contract.businessSector,
    105,
    322,
    { maxWidth: 290, size: 8 }
  );
  drawValue(
    page,
    font,
    contract.functionStage,
    70,
    280,
    { maxWidth: 490, size: 8 }
  );
  drawPaidCheck(page, font, contract);
  drawValue(
    page,
    font,
    contract.isPaid ? displayMoney(contract.hourlySalary) : "",
    285,
    204,
    { maxWidth: 70, size: 8 }
  );
  drawValue(
    page,
    font,
    contract.monetaryCompensation,
    470,
    212,
    { maxWidth: 95, size: 8 }
  );
  drawValue(
    page,
    font,
    contract.otherCompensation,
    510,
    197,
    { maxWidth: 65, size: 8 }
  );
  drawDateParts(page, font, contract.startDate, 42, 146);
  drawDateParts(page, font, contract.endDate, 145, 146);
  drawValue(
    page,
    font,
    displayNumber(contract.hoursPerWeek),
    355,
    156,
    { maxWidth: 50, size: 8 }
  );
  drawValue(
    page,
    font,
    displayNumber(contract.numberOfWeeks),
    482,
    156,
    { maxWidth: 50, size: 8 }
  );
  drawScheduleCheck(page, font, contract.scheduleType);
  drawValue(
    page,
    font,
    displayNumber(contract.totalHours),
    532,
    120,
    { maxWidth: 50, size: 8 }
  );
}

function drawRequestValues(pdfDoc, font, request) {
  const pages = pdfDoc.getPages();
  const page = pages[0];

  drawValue(page, font, request.taskSummary, 95, 660, {
    maxWidth: 420,
    maxLines: 9,
    lineHeight: 10,
    size: 8
  });
  drawValue(page, font, formatDate(request.startDate), 130, 536, {
    maxWidth: 140
  });
  drawValue(page, font, formatDate(request.endDate), 340, 536, {
    maxWidth: 140
  });

  drawValue(page, font, request.companyName, 235, 493, {
    maxWidth: 300
  });
  drawValue(page, font, request.companyAddress, 130, 462, {
    maxWidth: 170
  });
  drawValue(page, font, cityWithProvince(
    request.companyCity,
    request.companyProvince
  ), 330, 462, {
    maxWidth: 150
  });
  drawValue(
    page,
    font,
    request.companyPostalCode,
    150,
    431,
    { maxWidth: 85 }
  );
  drawValue(page, font, request.companyPhone, 270, 431, {
    maxWidth: 100
  });
  drawValue(
    page,
    font,
    request.companyPhoneExtension,
    410,
    431,
    { maxWidth: 65 }
  );
  drawValue(page, font, request.hrName, 220, 374, {
    maxWidth: 100,
    maxLines: 2,
    lineHeight: 10
  });
  drawValue(page, font, request.hrEmail, 410, 386, {
    maxWidth: 110,
    maxLines: 2,
    lineHeight: 10
  });
  drawValue(page, font, request.hrPhone, 150, 345, {
    maxWidth: 120
  });
  drawValue(page, font, request.hrExtension, 410, 345, {
    maxWidth: 65
  });
  drawValue(page, font, request.workSchedule, 185, 307, {
    maxWidth: 90,
    maxLines: 2,
    lineHeight: 10
  });
  drawValue(
    page,
    font,
    displayNumber(request.hoursPerWeek),
    310,
    297,
    { maxWidth: 60 }
  );
  drawValue(page, font, request.workLanguage, 455, 307, {
    maxWidth: 70,
    maxLines: 2,
    lineHeight: 10
  });
  drawValue(page, font, request.companyWebsite, 220, 282, {
    maxWidth: 80
  });

  drawValue(page, font, request.supervisorName, 135, 212, {
    maxWidth: 180
  });
  drawValue(page, font, request.supervisorTitle, 420, 212, {
    maxWidth: 170
  });
  drawValue(page, font, request.supervisorEmail, 135, 192, {
    maxWidth: 250
  });

  drawValue(page, font, fullStudentName(request), 130, 162, {
    maxWidth: 240
  });
  drawValue(page, font, request.studentGroup, 440, 162, {
    maxWidth: 80
  });
  drawValue(page, font, request.studentEmail, 100, 138, {
    maxWidth: 170
  });
  drawValue(page, font, request.studentPhone, 290, 138, {
    maxWidth: 100
  });
  drawValue(
    page,
    font,
    formatDate(request.expirationCaq),
    260,
    96,
    { maxWidth: 90 }
  );
  drawValue(
    page,
    font,
    formatDate(request.expirationStudyPermit),
    300,
    83,
    { maxWidth: 90 }
  );
  drawValue(
    page,
    font,
    formatDate(request.expirationInsurance),
    420,
    102,
    { maxWidth: 90 }
  );
}

function drawValue(
  page,
  font,
  value,
  x,
  y,
  {
    maxWidth = 120,
    maxLines = 1,
    size = 8,
    lineHeight = 11,
    verticalOffset = 3
  } = {}
) {
  const text = cleanPdfText(value);

  if (!text) {
    return;
  }

  const lines = wrapText(text, font, size, maxWidth)
    .slice(0, maxLines);

  lines.forEach((line, index) => {
    const fittedSize = fitTextSize(
      line,
      font,
      size,
      maxWidth
    );

    page.drawText(line, {
      x,
      y: y + verticalOffset - index * lineHeight,
      size: fittedSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth
    });
  });
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }

      lines.push(
        ...splitLongWord(word, font, size, maxWidth)
      );
      continue;
    }

    const candidate = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(candidate, size) > maxWidth &&
      currentLine
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [text];
}

function splitLongWord(word, font, size, maxWidth) {
  const segments = [];
  let current = "";

  for (const character of word) {
    const candidate = `${current}${character}`;

    if (
      current &&
      font.widthOfTextAtSize(candidate, size) > maxWidth
    ) {
      segments.push(current);
      current = character;
      continue;
    }

    current = candidate;
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

function fitTextSize(text, font, size, maxWidth) {
  let fittedSize = size;

  while (
    fittedSize > 5.5 &&
    font.widthOfTextAtSize(text, fittedSize) > maxWidth
  ) {
    fittedSize -= 0.25;
  }

  return Number(fittedSize.toFixed(2));
}

function drawCheck(page, font, x, y) {
  page.drawText("X", {
    x,
    y,
    size: 12,
    font,
    color: rgb(0, 0, 0)
  });
}

function drawSessionCheck(page, font, session) {
  const value = String(session || "").toUpperCase();

  if (value.includes("AUTOMNE")) {
    drawCheck(page, font, 205, 637);
    return;
  }

  if (value.includes("HIVER")) {
    drawCheck(page, font, 266, 637);
    return;
  }

  if (value.includes("ETE") || value.includes("ÉTÉ")) {
    drawCheck(page, font, 315, 637);
    return;
  }

  drawValue(page, font, session, 155, 648, {
    maxWidth: 70,
    size: 8
  });
}

function drawOrganizationCheck(page, font, value) {
  const type = String(value || "").toUpperCase();

  if (type === "PUBLIC") {
    drawCheck(page, font, 478, 354);
  }

  if (type === "PRIVE" || type === "PRIVÉ") {
    drawCheck(page, font, 535, 354);
  }
}

function drawPaidCheck(page, font, contract) {
  if (contract.isPaid) {
    drawCheck(page, font, 167, 197);
    return;
  }

  drawCheck(page, font, 125, 197);
}

function drawScheduleCheck(page, font, scheduleType) {
  if (scheduleType === "TEMPS_PARTIEL") {
    drawCheck(page, font, 188, 113);
  }

  if (scheduleType === "TEMPS_PLEIN") {
    drawCheck(page, font, 418, 113);
  }
}

function drawDateParts(page, font, value, x, y) {
  const parts = parseDateParts(value);

  drawValue(page, font, parts.day, x, y, {
    maxWidth: 22,
    size: 7
  });
  drawValue(page, font, parts.month, x + 31, y, {
    maxWidth: 22,
    size: 7
  });
  drawValue(page, font, parts.year, x + 61, y, {
    maxWidth: 32,
    size: 7
  });
}

function parseDateParts(value) {
  const formatted = formatDate(value);

  if (!formatted) {
    return { day: "", month: "", year: "" };
  }

  const [year, month, day] = formatted.split("-");

  return { day, month, year };
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

function cleanPdfText(value) {
  return String(value ?? "")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u0152/g, "OE")
    .replace(/\u0153/g, "oe")
    .split("")
    .map((character) =>
      isSupportedPdfCharacter(character)
        ? character
        : " "
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function isSupportedPdfCharacter(character) {
  const code = character.charCodeAt(0);

  return code === 9 ||
    code === 10 ||
    code === 13 ||
    (code >= 32 && code <= 255);
}

function fullStudentName(source) {
  return [
    source.studentFirstName,
    source.studentLastName
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function cityWithProvince(city, province) {
  return [city, province]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");
}

function dateRange(source) {
  const startDate = formatDate(source.startDate);
  const endDate = formatDate(source.endDate);

  if (!startDate && !endDate) {
    return "";
  }

  return `${startDate || "-"} au ${endDate || "-"}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const dateValue = String(value).slice(0, 10);
  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return dateValue;
}

function displayNumber(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return String(numberValue);
}

function displayMoney(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return `${numberValue.toFixed(2)} $`;
}

function firstValue(...values) {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
}

function normalizeContractSigners(signers) {
  if (!Array.isArray(signers)) {
    return [];
  }

  return signers
    .map((signer) => ({
      ...signer,
      role: String(signer.role || "").toUpperCase(),
      status: String(signer.status || "").toUpperCase(),
      signedAt: signer.signedAt || signer.signeLe || null,
      signatureProvider: firstValue(
        signer.signatureProvider,
        signer.provider,
        signer.fournisseurSignature
      )
    }))
    .filter((signer) =>
      signerRoleOrder.includes(signer.role)
    )
    .sort(
      (first, second) =>
        signerRoleOrder.indexOf(first.role) -
        signerRoleOrder.indexOf(second.role)
    );
}

function signerRolePdfLabel(role) {
  const labels = {
    ETUDIANT: "Etudiant",
    ENTREPRISE: "Milieu de stage",
    SUPERVISEUR: "Enseignant",
    CONSEILLERE: "Conseillere",
    DIRECTION: "Direction"
  };

  return labels[role] || role || "-";
}

function signerStatusPdfLabel(status) {
  const labels = {
    SIGNE: "Signe",
    ENVOYE: "Envoye",
    EN_ATTENTE: "En attente",
    REFUSE: "Refuse",
    EXPIRE: "Expire"
  };

  return labels[status] || status || "-";
}

function signatureProviderLabel(signer = {}) {
  if (!signer) {
    return "-";
  }

  const provider = String(
    signer.signatureProvider || ""
  ).toUpperCase();

  if (provider === "DOCUMENSO") {
    return "Signature Documenso";
  }

  if (provider === "AUTRE") {
    return "Signature en presentiel";
  }

  return provider
    ? `Signature ${provider}`
    : "Signature StageTec";
}

function formatDateTimeForPdf(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return formatDate(value) || "-";
  }

  return date.toLocaleString("fr-CA", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}
