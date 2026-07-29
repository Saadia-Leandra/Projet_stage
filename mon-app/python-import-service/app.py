import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from normalizer import CsvValidationError, normalize_student_csv


MAX_BODY_BYTES = 8 * 1024 * 1024


class CsvServiceHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/v1/students/normalize":
            self._send_json(404, {"erreur": "Route introuvable."})
            return

        configured_token = os.environ.get("CSV_SERVICE_TOKEN")
        if configured_token and self.headers.get("X-Service-Token") != configured_token:
            self._send_json(401, {"erreur": "Jeton de service invalide."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            self._send_json(413, {"erreur": "Requête trop volumineuse ou vide."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
            result = normalize_student_csv(payload)
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"erreur": "Le corps JSON est invalide."})
            return
        except CsvValidationError as error:
            self._send_json(400, {"erreur": str(error)})
            return
        except Exception:
            self._send_json(500, {"erreur": "Le fichier CSV n'a pas pu être analysé."})
            return

        self._send_json(200, result)

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[csv-service] {self.address_string()} - {format % args}")


if __name__ == "__main__":
    host = os.environ.get("CSV_SERVICE_HOST", "127.0.0.1")
    port = int(os.environ.get("CSV_SERVICE_PORT", "8001"))
    server = ThreadingHTTPServer((host, port), CsvServiceHandler)
    print(f"Service CSV lancé sur http://{host}:{port}")
    server.serve_forever()
