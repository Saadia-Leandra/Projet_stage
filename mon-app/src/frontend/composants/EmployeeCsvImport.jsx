import { useRef, useState } from "react";

const HEADERS = [
  "courriel", "prenom", "nom", "telephone", "telephone_secondaire", "role",
  "numero_employe", "departement", "service", "taux_horaire",
  "taux_kilometrique"
];
const EXAMPLES = [
  ["superviseur@teccart.com", "Nadia", "Roy", "514-555-0100", "", "SUPERVISEUR", "EMP-1003", "Informatique", "", "52.500", "0.610"],
  ["conseillere@teccart.com", "Julie", "Cote", "514-555-0101", "", "CONSEILLERE", "", "Stages", "", "", ""],
  ["compta2@teccart.com", "Marc", "Gagne", "514-555-0102", "", "COMPTABILITE", "COMPTA-02", "", "Comptabilite", "", ""]
];

export default function EmployeeCsvImport() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(endpoint) {
    if (!file) { setError("Sélectionnez d’abord un fichier CSV."); return; }
    setLoadingAction(endpoint); setError(""); setSuccess("");
    try {
      const body = new FormData(); body.append("csv", file);
      const response = await fetch(`/api/employee-imports/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.details) setPreview(data.details);
        throw new Error(data.error || "L’importation a échoué.");
      }
      if (endpoint === "preview") { setPreview(data); return; }
      setSuccess(data.message || `${data.imported || 0} employé(s) importé(s).`);
      clear({ preserveMessage: true });
    } catch (requestError) { setError(requestError.message || "L’importation a échoué."); }
    finally { setLoadingAction(""); }
  }

  function clear({ preserveMessage = false } = {}) {
    setFile(null); setPreview(null); setError("");
    if (!preserveMessage) setSuccess("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadTemplate() {
    const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = `\uFEFF${HEADERS.join(",")}\r\n${EXAMPLES.map((row) => row.map(escape).join(",")).join("\r\n")}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = "modele_import_employes.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <section className="panel csvImportPanel">
      <div className="panelHeader">
        <div>
          <h2>Importer les employés</h2>
          <p>Créez en une seule opération les comptes de comptabilité, des conseillères et des superviseurs.</p>
        </div>
        <button className="linkButton" type="button" onClick={downloadTemplate}>Télécharger le modèle CSV</button>
      </div>
      <div className="csvImportHelp">
        <strong>À retenir</strong>
        <span>Le rôle doit être SUPERVISEUR, CONSEILLERE ou COMPTABILITE. Le numéro d’employé et le taux horaire sont obligatoires pour un superviseur.</span>
      </div>
      <label className="csvFileField" htmlFor="employeeCsvFile">
        <span>Fichier des employés au format CSV</span>
        <input ref={inputRef} id="employeeCsvFile" type="file" accept=".csv,text/csv"
          onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setError(""); setSuccess(""); }} />
        {file && <small>{file.name} — {(file.size / 1024).toFixed(1)} Ko</small>}
      </label>
      <div className="csvImportActions">
        <button type="button" disabled={!file || loadingAction} onClick={() => submit("preview")}>
          {loadingAction === "preview" ? "Analyse en cours..." : "Vérifier le fichier"}
        </button>
        <button className="secondaryButton" type="button" disabled={!preview?.valide || loadingAction} onClick={() => submit("commit")}>
          {loadingAction === "commit" ? "Importation en cours..." : "Importer dans la base"}
        </button>
        <button className="secondaryButton" type="button" disabled={Boolean(loadingAction)} onClick={() => clear()}>Réinitialiser</button>
      </div>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      {preview && <EmployeePreview preview={preview} />}
    </section>
  );
}

function EmployeePreview({ preview }) {
  return <div className="csvPreview">
    <div className="csvSummary"><span>{preview.nombreLignes} ligne(s)</span><span>{preview.nombreValides} valide(s)</span><span className={preview.nombreErreurs ? "csvErrorCount" : ""}>{preview.nombreErreurs} erreur(s)</span></div>
    {preview.erreurs?.length > 0 && <div className="csvErrors"><h3>Corrections nécessaires</h3><ul>{preview.erreurs.map((item) => <li key={item.ligne}>Ligne {item.ligne} : {item.erreurs.join("; ")}</li>)}</ul></div>}
    {preview.lignes?.length > 0 && <div className="csvTableWrap"><table><thead><tr><th>Employé</th><th>Courriel</th><th>Rôle</th><th>No employé</th><th>Département/service</th><th>Taux horaire</th></tr></thead><tbody>
      {preview.lignes.slice(0, 50).map((row, index) => <tr key={`${row.courriel}-${index}`}><td>{row.prenom} {row.nom}</td><td>{row.courriel}</td><td>{row.role}</td><td>{row.numero_employe || "—"}</td><td>{row.departement || row.service || "—"}</td><td>{row.taux_horaire ? `${row.taux_horaire} $/h` : "—"}</td></tr>)}
    </tbody></table></div>}
  </div>;
}
