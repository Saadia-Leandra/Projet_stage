import base64
import importlib.util
import sys
import unittest
from pathlib import Path


APP_PATH = Path(__file__).resolve().parents[1] / "app.py"
sys.path.insert(0, str(APP_PATH.parent))
SPEC = importlib.util.spec_from_file_location("csv_import_app", APP_PATH)
APP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(APP)


def payload(text):
    return {
        "nomFichier": "etudiants.csv",
        "contenuBase64": base64.b64encode(text.encode("utf-8")).decode("ascii"),
    }


class NormalizeCsvTests(unittest.TestCase):
    def test_normalizes_valid_student(self):
        content = (
            "courriel;prenom;nom;mot_de_passe_temporaire;"
            "code_etudiant;programme;expiration_caq\n"
            "Marie@Example.com;Marie;Tremblay;ChangerMoi123!;"
            "2600100;Web;2027-08-31\n"
        )
        result = APP.normalize_student_csv(payload(content))

        self.assertTrue(result["valide"])
        self.assertEqual(result["nombreValides"], 1)
        self.assertEqual(result["lignes"][0]["courriel"], "marie@example.com")

    def test_reports_all_row_errors(self):
        content = (
            "courriel,prenom,nom,mot_de_passe_temporaire,"
            "code_etudiant,programme,expiration_caq\n"
            "invalide,Marie,Tremblay,123,2600100,Web,31-08-2027\n"
        )
        result = APP.normalize_student_csv(payload(content))

        self.assertFalse(result["valide"])
        self.assertEqual(result["nombreErreurs"], 1)
        self.assertGreaterEqual(len(result["erreurs"][0]["erreurs"]), 3)

    def test_rejects_missing_columns(self):
        with self.assertRaisesRegex(APP.CsvValidationError, "Colonnes obligatoires"):
            APP.normalize_student_csv(payload("courriel,prenom\nx@example.com,X\n"))


if __name__ == "__main__":
    unittest.main()
