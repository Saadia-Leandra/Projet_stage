import {
  importStudentCsv as importNormalizedStudentCsv,
  previewStudentCsv as previewNormalizedStudentCsv
} from "./studentCsvImportService.js";

export function previewStudentCsv(file) {
  return previewNormalizedStudentCsv(normalizeClaraHeaders(file));
}

export function importStudentCsv(file) {
  return importNormalizedStudentCsv(normalizeClaraHeaders(file));
}

function normalizeClaraHeaders(file) {
  if (!file?.buffer?.length) return file;

  const text = file.buffer.toString("utf8");
  const newlineIndex = text.search(/\r?\n/);
  const header = newlineIndex >= 0 ? text.slice(0, newlineIndex) : text;

  if (
    !/(^|[,;])telephone_principal([,;]|$)/i.test(header) ||
    !/(^|[,;])telephone_secondaire([,;]|$)/i.test(header)
  ) {
    return file;
  }

  const normalizedHeader = header.replace(
    /(^|[,;])telephone_secondaire(?=[,;]|$)/i,
    "$1telephone_secondaire_ignoree"
  );

  return {
    ...file,
    buffer: Buffer.from(
      normalizedHeader + (newlineIndex >= 0 ? text.slice(newlineIndex) : ""),
      "utf8"
    )
  };
}
