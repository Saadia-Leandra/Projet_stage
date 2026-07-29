import base64
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from normalizer import CsvValidationError, normalize_student_csv


HEADERS = (
    "courriel,prenom,nom,telephone,mot_de_passe_temporaire,code_etudiant,"
    "programme,cohorte,adresse,ville,province,code_postal,code_permanent,"
    "groupe,expiration_caq,expiration_permis_etudes,expiration_assurance,"
    "numero_employe_superviseur"
)


def payload(csv_text):
    return {
        "nomFichier": "etudiants.csv",
        "contenuBase64": base64.b64encode(csv_text.encode("utf-8")).decode("ascii"),
    }


class NormalizeStudentCsvTests(unittest.TestCase):
    def test_normalizes_a_valid_csv(self):
        row = (
            " MARIE@EXAMPLE.COM ,Marie,Tremblay,,ChangerMoi123!,2600100,"
            "Développement web,2026,,,,,,,2027-08-31,,,EMP-1001"
        )
        result = normalize_student_csv(payload(f"{HEADERS}\n{row}\n"))
        self.assertTrue(result["valide"])
        self.assertEqual(result["nombreValides"], 1)
        self.assertEqual(result["lignes"][0]["courriel"], "marie@example.com")

    def test_reports_row_errors_and_duplicates(self):
        rows = (
            "test@example.com,A,B,,123,ABC,Web,,,,,,,,2027-99-01,,,\n"
            "TEST@example.com,C,D,,12345678,ABC,Web,,,,,,,,,,,\n"
        )
        result = normalize_student_csv(payload(f"{HEADERS}\n{rows}"))
        self.assertFalse(result["valide"])
        self.assertEqual(result["nombreErreurs"], 2)
        self.assertIn("mot de passe", " ".join(result["erreurs"][0]["erreurs"]))
        self.assertIn("déjà présent", " ".join(result["erreurs"][1]["erreurs"]))

    def test_rejects_missing_required_headers(self):
        with self.assertRaises(CsvValidationError):
            normalize_student_csv(payload("courriel,prenom\nx@example.com,A\n"))


if __name__ == "__main__":
    unittest.main()
