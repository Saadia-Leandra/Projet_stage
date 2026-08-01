import { useRef, useState } from "react";

const CLARA_HEADERS = [
  "numero_dossier",
  "nom",
  "prenom",
  "code_permanent",
  "numero_programme",
  "numero_grille",
  "spe",
  "telephone_principal",
  "telephone_secondaire",
  "email"
];

const CLARA_EXAMPLE = [
  "2600100",
  "Tremblay",
  "Marie",
  "TREM01010101",
  "420.B0",
  "420-B0-2026",
  "Developpement web",
  "514-555-0101",
  "",
  "marie.tremblay@example.com"
];

export default function StudentCsvImport() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loading = Boolean(loadingAction);

  async function submit(endpoint) {
    if (!file) {
      setError("Sélectionnez d’abord un fichier CSV exporté de Clara.");
      return;
    }

    setLoadingAction(endpoint);
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
        throw new Error(data.error || "L’importation a échoué.");
      }

      if (endpoint === "preview") {
        setPreview(data);
        return;
      }

      setSuccess(
        data.message ||
          `${data.imported || 0} étudiant(s) importé(s) avec succès.`
      );
      clearSelection({ preserveMessage: true });
    } catch (requestError) {
      setError(requestError.message || "L’importation a échoué.");
    } finally {
      setLoadingAction("");
    }
  }

  function clearSelection({ preserveMessage = false } = {}) {
    setFile(null);
    setPreview(null);
    setError("");
    if (!preserveMessage) setSuccess("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const csv =
      `\uFEFF${CLARA_HEADERS.join(",")}\r\n` +
      `${CLARA_EXAMPLE.join(",")}\r\n`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modele_export_clara_etudiants.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel csvImportPanel">
      <div className="panelHeader">
        <div>
          <h2>Importer des étudiants depuis Clara</h2>
          <p>
            Sélectionnez l’export Clara, contrôlez les données détectées, puis
            confirmez la création des comptes étudiants.
          </p>
        </div>
        <button className="linkButton" type="button" onClick={downloadTemplate}>
          Télécharger le modèle Clara
        </button>
      </div>

      <div className="csvImportHelp">
        <strong>Colonnes Clara reconnues</strong>
        <span>
          numero_dossier, nom, prenom, code_permanent, numero_programme,
          numero_grille, spe, telephone_principal, telephone_secondaire et
          email.
        </span>
        <span>
          Le numéro de dossier devient le code étudiant, « spe » devient le
          programme et « email » devient le courriel de connexion.
        </span>
      </div>

      <label className="csvFileField" htmlFor="studentCsvFile">
        <span>Export Clara au format CSV</span>
        <input
          ref={fileInputRef}
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
        {file && (
          <small>
            {file.name} — {formatFileSize(file.size)}
          </small>
        )}
      </label>

      <div className="csvImportActions">
        <button
          type="button"
          disabled={!file || loading}
          onClick={() => submit("preview")}
        >
          {loadingAction === "preview"
            ? "Analyse en cours..."
            : "Vérifier le fichier"}
        </button>
        <button
          className="secondaryButton"
          type="button"
          disabled={!preview?.valide || loading}
          onClick={() => submit("commit")}
        >
          {loadingAction === "commit"
            ? "Importation en cours..."
            : "Importer dans la base"}
        </button>
        <button
          className="secondaryButton"
          type="button"
          disabled={loading}
          onClick={() => clearSelection()}
        >
          Réinitialiser
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
          <h3>Corrections nécessaires</h3>
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
                <th>Dossier</th>
                <th>Étudiant</th>
                <th>Courriel</th>
                <th>Programme</th>
                <th>Grille</th>
              </tr>
            </thead>
            <tbody>
              {preview.lignes.slice(0, 50).map((row, index) => (
                <tr key={`${row.courriel}-${row.code_etudiant}-${index}`}>
                  <td>{row.code_etudiant}</td>
                  <td>
                    {row.prenom} {row.nom}
                  </td>
                  <td>{row.courriel}</td>
                  <td>{row.programme}</td>
                  <td>{row.groupe || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.lignes.length > 50 && (
            <p className="panelSubtle">
              Les 50 premières lignes sont affichées sur{" "}
              {preview.lignes.length}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} octets`;
  return `${(bytes / 1024).toFixed(1)} Ko`;
}
