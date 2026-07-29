import base64
import csv
import io
import re
from datetime import date


HEADERS = (
    "courriel", "prenom", "nom", "telephone", "mot_de_passe_temporaire",
    "code_etudiant", "programme", "cohorte", "adresse", "ville", "province",
    "code_postal", "code_permanent", "groupe", "expiration_caq",
    "expiration_permis_etudes", "expiration_assurance",
    "numero_employe_superviseur",
)
REQUIRED_HEADERS = {
    "courriel", "prenom", "nom", "mot_de_passe_temporaire",
    "code_etudiant", "programme",
}
DATE_HEADERS = (
    "expiration_caq", "expiration_permis_etudes", "expiration_assurance",
)
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class CsvValidationError(ValueError):
    pass


def normalize_student_csv(payload):
    file_name = str(payload.get("nomFichier") or "")
    encoded_content = payload.get("contenuBase64")

    if not file_name.lower().endswith(".csv"):
        raise CsvValidationError("Le fichier doit être au format CSV.")
    if not isinstance(encoded_content, str) or not encoded_content:
        raise CsvValidationError("Le contenu du fichier CSV est manquant.")

    try:
        raw = base64.b64decode(encoded_content, validate=True)
    except (ValueError, TypeError):
        raise CsvValidationError("Le contenu Base64 du fichier est invalide.")

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise CsvValidationError("Le fichier CSV doit être encodé en UTF-8.")

    reader = _create_reader(text)
    source_headers = [str(value or "").strip() for value in (reader.fieldnames or [])]
    missing = sorted(REQUIRED_HEADERS.difference(source_headers))
    if missing:
        raise CsvValidationError(
            "Colonnes obligatoires manquantes : " + ", ".join(missing) + "."
        )

    lines = []
    errors = []
    seen_emails = {}
    seen_codes = {}

    for line_number, source_row in enumerate(reader, start=2):
        if None in source_row:
            errors.append({
                "ligne": line_number,
                "erreurs": ["La ligne contient plus de colonnes que l'en-tête."],
            })
            continue

        row = {
            header: str(source_row.get(header) or "").strip()
            for header in HEADERS
        }
        if not any(row.values()):
            continue

        row["courriel"] = row["courriel"].lower()
        row_errors = _validate_row(row, seen_emails, seen_codes, line_number)
        lines.append(row)
        if row_errors:
            errors.append({"ligne": line_number, "erreurs": row_errors})

    if not lines:
        raise CsvValidationError("Le fichier CSV ne contient aucune ligne de données.")

    return {
        "valide": not errors,
        "nombreLignes": len(lines),
        "nombreValides": len(lines) - len(errors),
        "nombreErreurs": len(errors),
        "lignes": lines,
        "erreurs": errors,
    }


def _create_reader(text):
    if not text.strip():
        raise CsvValidationError("Le fichier CSV est vide.")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;")
    except csv.Error:
        dialect = csv.excel
    return csv.DictReader(io.StringIO(text, newline=""), dialect=dialect)


def _validate_row(row, seen_emails, seen_codes, line_number):
    errors = []
    for header in sorted(REQUIRED_HEADERS):
        if not row[header]:
            errors.append(f"La colonne {header} est obligatoire.")

    if row["courriel"] and not EMAIL_PATTERN.fullmatch(row["courriel"]):
        errors.append("Le courriel est invalide.")
    if row["mot_de_passe_temporaire"] and len(row["mot_de_passe_temporaire"]) < 8:
        errors.append("Le mot de passe temporaire doit contenir au moins 8 caractères.")

    for header in DATE_HEADERS:
        value = row[header]
        if value:
            try:
                date.fromisoformat(value)
            except ValueError:
                errors.append(f"La colonne {header} doit respecter le format AAAA-MM-JJ.")

    _record_duplicate(errors, seen_emails, row["courriel"], line_number, "courriel")
    _record_duplicate(
        errors, seen_codes, row["code_etudiant"], line_number, "code étudiant"
    )
    return errors


def _record_duplicate(errors, seen, value, line_number, label):
    key = value.casefold()
    if not key:
        return
    if key in seen:
        errors.append(f"Le {label} est déjà présent à la ligne {seen[key]}.")
    else:
        seen[key] = line_number
