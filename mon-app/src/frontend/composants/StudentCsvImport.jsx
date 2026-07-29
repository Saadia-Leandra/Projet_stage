import { useState } from "react";

const TEMPLATE_HEADERS = [
  "courriel",
  "prenom",
  "nom",
  "telephone",
  "mot_de_passe_temporaire",
  "code_etudiant",
  "programme",
  "cohorte",
  "adresse",
  "ville",
  "province",
  "code_postal",
  "code_permanent",
  "groupe",
  "expiration_caq",
  "expiration_permis_etudes",
  "expiration_assurance",
  "numero_employe_superviseur"
];

export default function StudentCsvImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(endpoint) {
    if (!file) {
      setError("Selectionnez d'abord un fichier CSV.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const body = new FormData();
      body.append("csv", file);
      const response = await fetch(`/api/student-imports/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.details) setPreview(data.details);
        throw new Error(data.error || "L'importation a echoue.");
      }

      if (endpoint === "preview") {
        setPreview(data);
      } else {
        setSuccess(data.message);
        setPreview(null);
        setFile(null);
        document.getElementById("studentCsvFile").value = "";
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function downloadTemplate() {
    const example = [
      "etudiant@example.com",
      "Marie",
      "Tremblay",
      "514-555-0101",
      "ChangerMoi123!",
      "2600100",
      "Developpement web",
      "2026",
      "100 rue Exemple",
      "Montreal",
      "Quebec",
      "H2X 1A1",
      "TREM01010101",
      "WEB-2026-A",
      "2027-08-31",
      "2027-08-31",
      "2027-08-31",
      "EMP-001"
    ];
    const csv = `\uFEFF${TEMPLATE_HEADERS.join(",")}\r\n${example.join(",")}\r\n`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modele_import_etudiants.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel csvImportPanel">
      <div className="panelHeader">
        <div>
          <h2>Importer des etudiants</h2>
          <p>
            Verifiez le fichier avant de creer les comptes et les dossiers de stage.
          </p>
        </div>
        <button className="linkButton" type="button" onClick={downloadTemplate}>
          Telecharger le modele CSV
        </button>
      </div>

      <div className="csvImportHelp">
        <strong>Colonnes obligatoires</strong>
        <span>
          courriel, prenom, nom, mot_de_passe_temporaire, code_etudiant et programme.
        </span>
        <span>Les dates doivent respecter le format AAAA-MM-JJ.</span>
      </div>

      <label className="csvFileField" htmlFor="studentCsvFile">
        <span>Fichier CSV</span>
        <input
          id="studentCsvFile"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
            setError("");
            setSuccess("");
          }}
        />
      </label>

      <div className="csvImportActions">
        <button
          type="button"
          disabled={!file || loading}
          onClick={() => submit("preview")}
        >
          {loading ? "Analyse en cours..." : "Verifier le fichier"}
        </button>
        <button
          className="secondaryButton"
          type="button"
          disabled={!preview?.valide || loading}
          onClick={() => submit("commit")}
        >
          Importer dans la base
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {preview && <ImportPreview preview={preview} />}
    </section>
  );
}

function ImportPreview({ preview }) {
  return (
    <div className="csvPreview">
      <div className="csvSummary">
        <span>{preview.nombreLignes} ligne(s)</span>
        <span>{preview.nombreValides} valide(s)</span>
        <span className={preview.nombreErreurs ? "csvErrorCount" : ""}>
          {preview.nombreErreurs} erreur(s)
        </span>
      </div>

      {preview.erreurs?.length > 0 && (
        <div className="csvErrors">
          <h3>Corrections necessaires</h3>
          <ul>
            {preview.erreurs.map((item) => (
              <li key={item.ligne}>
                Ligne {item.ligne} : {item.erreurs.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.lignes?.length > 0 && (
        <div className="csvTableWrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Etudiant</th>
                <th>Courriel</th>
                <th>Programme</th>
                <th>Superviseur</th>
              </tr>
            </thead>
            <tbody>
              {preview.lignes.slice(0, 50).map((row) => (
                <tr key={`${row.courriel}-${row.code_etudiant}`}>
                  <td>{row.code_etudiant}</td>
                  <td>{row.prenom} {row.nom}</td>
                  <td>{row.courriel}</td>
                  <td>{row.programme}</td>
                  <td>{row.numero_employe_superviseur || "Non assigne"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
