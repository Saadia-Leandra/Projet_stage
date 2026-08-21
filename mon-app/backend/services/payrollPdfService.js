import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 36;
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TABLE_HEADER_HEIGHT = 22;
const TABLE_ROW_HEIGHT = 19;

export async function createPayrollPdf({ supervisor, charges, trips }) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page;
  let y;

  const addPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - 50;
    page.drawText("StageTec - Rapport recapitulatif de paie", { x: MARGIN, y, size: 16, font: bold, color: rgb(0.08, 0.24, 0.38) });
    page.drawText(`Genere le ${new Date().toISOString().slice(0, 10)}`, { x: 620, y: y + 2, size: 8, font: regular, color: rgb(0.35, 0.4, 0.45) });
    y -= 28;
  };
  const ensureSpace = (height = 18) => { if (y - height < MARGIN) addPage(); };
  const text = (value, x, options = {}) => page.drawText(safe(value), { x, y: options.y ?? y, size: options.size || 9, font: options.bold ? bold : regular, color: options.color || rgb(0.1, 0.12, 0.14), maxWidth: options.maxWidth });
  const money = (value) => `${Number(value || 0).toFixed(2)} $`;
  const supervisionTotal = charges.reduce((sum, row) => sum + Number(row.amount), 0);
  const mileageTotal = trips.reduce((sum, row) => sum + Number(row.amount), 0);

  addPage();
  text("Superviseur", MARGIN, { bold: true }); text(supervisor.supervisorName, 125);
  y -= 15; text("No employe", MARGIN, { bold: true }); text(supervisor.employeeNumber || "-", 125);
  y -= 15; text("Courriel", MARGIN, { bold: true }); text(supervisor.supervisorEmail || "-", 125);
  y -= 25;

  const summaries = [
    ["Etudiants", new Set(charges.map((row) => row.studentCode)).size],
    ["Heures supervision", charges.reduce((sum, row) => sum + Number(row.hours), 0)],
    ["Supervision", money(supervisionTotal)],
    ["Kilometrage", money(mileageTotal)],
    ["TOTAL", money(supervisionTotal + mileageTotal)]
  ];
  summaries.forEach(([label, value], index) => {
    const x = MARGIN + index * 144;
    page.drawRectangle({ x, y: y - 24, width: 132, height: 38, color: index === 4 ? rgb(0.86, 0.94, 0.9) : rgb(0.93, 0.95, 0.97) });
    text(label, x + 8, { y: y + 2, size: 8, bold: true });
    text(value, x + 8, { y: y - 15, size: 11, bold: true });
  });
  y -= 54;

  text("Charges de supervision", MARGIN, { size: 12, bold: true }); y -= 18;
  const chargeColumns = [
    { width: 76 }, { width: 76 }, { width: 210 },
    { width: 62, align: "right" }, { width: 86, align: "right" },
    { width: 96, align: "right" }, { width: 114 }
  ];
  drawHeader(["Date", "Code", "Etudiant", "Heures", "Taux", "Montant", "Statut"], chargeColumns);
  for (const row of charges) {
    if (y - TABLE_ROW_HEIGHT < MARGIN) {
      addPage();
      text("Charges de supervision (suite)", MARGIN, { size: 12, bold: true }); y -= 18;
      drawHeader(["Date", "Code", "Etudiant", "Heures", "Taux", "Montant", "Statut"], chargeColumns);
    }
    const values = [formatDate(row.createdAt), row.studentCode, row.studentName, row.hours, money(row.hourlyRate), money(row.amount), row.status];
    drawRow(values, chargeColumns);
  }

  y -= 12; ensureSpace(75); text("Deplacements", MARGIN, { size: 12, bold: true }); y -= 18;
  const tripColumns = [
    { width: 100 }, { width: 115, align: "right" },
    { width: 105, align: "right" }, { width: 130, align: "right" },
    { width: 120, align: "right" }, { width: 150 }
  ];
  drawHeader(["Date", "Distance (km)", "Taux/km", "Stationnement", "Montant", "Statut"], tripColumns);
  for (const row of trips) {
    if (y - TABLE_ROW_HEIGHT < MARGIN) {
      addPage();
      text("Deplacements (suite)", MARGIN, { size: 12, bold: true }); y -= 18;
      drawHeader(["Date", "Distance (km)", "Taux/km", "Stationnement", "Montant", "Statut"], tripColumns);
    }
    drawRow([formatDate(row.tripDate), row.distanceKm, money(row.mileageRate), money(row.parkingAmount), money(row.amount), row.status], tripColumns);
  }

  const pages = document.getPages();
  pages.forEach((item, index) => item.drawText(`Page ${index + 1} / ${pages.length}`, { x: 700, y: 18, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) }));
  return Buffer.from(await document.save());

  function drawHeader(labels, columns) {
    const bottom = y - TABLE_HEADER_HEIGHT;
    page.drawRectangle({ x: MARGIN, y: bottom, width: TABLE_WIDTH, height: TABLE_HEADER_HEIGHT, color: rgb(0.08, 0.24, 0.38) });
    drawCells(labels, true, columns, bottom + 7);
    y = bottom;
  }
  function drawRow(values, columns) {
    const bottom = y - TABLE_ROW_HEIGHT;
    drawCells(values, false, columns, bottom + 6);
    page.drawLine({ start: { x: MARGIN, y: bottom }, end: { x: MARGIN + TABLE_WIDTH, y: bottom }, thickness: 0.5, color: rgb(0.82, 0.84, 0.86) });
    y = bottom;
  }
  function drawCells(values, header, columns, baseline) {
    let x = MARGIN;
    values.forEach((value, index) => {
      const column = columns[index];
      const cellFont = header ? bold : regular;
      const clipped = truncate(safe(value), column.width - 12, cellFont, 8);
      const textWidth = cellFont.widthOfTextAtSize(clipped, 8);
      const textX = column.align === "right" ? x + column.width - textWidth - 6 : x + 6;
      page.drawText(clipped, { x: textX, y: baseline, size: 8, font: cellFont, color: header ? rgb(1, 1, 1) : rgb(0.1, 0.12, 0.14) });
      x += column.width;
    });
  }
}

function safe(value) { return String(value ?? "-").replace(/[^\x20-\x7E]/g, " "); }
function formatDate(value) { return value ? new Date(value).toISOString().slice(0, 10) : "-"; }
function truncate(value, width, font, size) {
  if (font.widthOfTextAtSize(value, size) <= width) return value;
  let result = value;
  while (result && font.widthOfTextAtSize(`${result}...`, size) > width) result = result.slice(0, -1);
  return `${result}...`;
}
