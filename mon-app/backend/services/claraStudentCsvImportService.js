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

  return file;
}
