import { useEffect, useState } from "react";

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadEmployees() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/employees", { headers: authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de charger les employés.");
      setEmployees(data.employees || []);
    } catch (loadError) { setError(loadError.message || "Impossible de charger les employés."); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEmployees(); }, []);

  async function saveEmployee(event) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/employees/${editing.userId}`, {
        method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(editing)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de modifier cet employé.");
      setEditing(null); setSuccess("Les informations de l’employé ont été modifiées.");
      await loadEmployees();
    } catch (saveError) { setError(saveError.message || "Impossible de modifier cet employé."); }
    finally { setSaving(false); }
  }

  async function changeStatus(employee) {
    const nextStatus = employee.statut === "ACTIF" ? "INACTIF" : "ACTIF";
    const action = nextStatus === "INACTIF" ? "archiver" : "réactiver";
    if (!window.confirm(`Voulez-vous ${action} ${employee.prenom} ${employee.nom} ?`)) return;
    setStatusLoadingId(employee.userId); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/employees/${employee.userId}/status`, {
        method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Impossible de modifier le statut.");
      setEmployees((items) => items.map((item) => item.userId === employee.userId ? { ...item, statut: nextStatus } : item));
      setSuccess(data.message || "Statut modifié.");
    } catch (statusError) { setError(statusError.message || "Impossible de modifier le statut."); }
    finally { setStatusLoadingId(null); }
  }

  return <section className="panel adminStudents">
    <div className="panelHeader"><div><h2>Gestion des employés</h2><p className="panelSubtle">{employees.length} compte(s) employé(s)</p></div></div>
    {error && <div className="error-message">{error}</div>}
    {success && <div className="success-message">{success}</div>}
    {loading ? <p>Chargement des employés...</p> : employees.length === 0 ? <p className="emptyState">Aucun employé n’a encore été créé.</p> :
      <div className="studentTableWrap"><table><thead><tr><th>Employé</th><th>Rôle</th><th>No employé</th><th>Courriel</th><th>Département/service</th><th>Taux horaire</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        {employees.map((employee) => <tr key={employee.userId}>
          <td>{employee.prenom} {employee.nom}</td><td>{roleLabel(employee.role)}</td><td>{employee.numero_employe || "—"}</td><td>{employee.courriel}</td>
          <td>{employee.departement || employee.service || "—"}</td><td>{employee.taux_horaire ? `${employee.taux_horaire} $/h` : "—"}</td>
          <td><span className={`statusPill ${employee.statut === "ACTIF" ? "statusGreen" : ""}`}>{employee.statut}</span></td>
          <td><div className="tableActions"><button className="secondaryButton fitButton" type="button" onClick={() => setEditing({ ...employee, telephone: employee.telephone || "", telephone_secondaire: employee.telephone_secondaire || "" })}>Modifier</button>
            <button className={`${employee.statut === "ACTIF" ? "dangerButton" : "secondaryButton"} fitButton`} type="button" disabled={statusLoadingId === employee.userId} onClick={() => changeStatus(employee)}>{statusLoadingId === employee.userId ? "Enregistrement..." : employee.statut === "ACTIF" ? "Archiver" : "Réactiver"}</button></div></td>
        </tr>)}
      </tbody></table></div>}
    {editing && <EmployeeModal employee={editing} saving={saving} onChange={(event) => setEditing((value) => ({ ...value, [event.target.name]: event.target.value }))} onCancel={() => setEditing(null)} onSubmit={saveEmployee} />}
  </section>;
}

function EmployeeModal({ employee, saving, onChange, onCancel, onSubmit }) {
  const supervisor = employee.role === "SUPERVISEUR";
  const accounting = employee.role === "COMPTABILITE";
  return <div className="modalOverlay"><div className="modalCard adminStudentModal managementModal" role="dialog" aria-modal="true" aria-labelledby="edit-employee-title">
    <div className="panelHeader managementModalHeader"><div><span className="managementModalEyebrow">Compte employé</span><h2 id="edit-employee-title">Modifier l’employé</h2><p className="panelSubtle">{employee.prenom} {employee.nom} · {roleLabel(employee.role)}</p></div><button className="modalCloseButton" type="button" disabled={saving} onClick={onCancel}>×</button></div>
    <form className="authForm managementForm" onSubmit={onSubmit}><div className="managementFormIntro"><strong>Informations professionnelles</strong><span>Le rôle du compte reste verrouillé pour préserver les données associées.</span></div><div className="formGrid">
      <Field label="Prénom" name="prenom" value={employee.prenom} onChange={onChange} /><Field label="Nom" name="nom" value={employee.nom} onChange={onChange} />
      <Field label="Courriel" name="courriel" type="email" value={employee.courriel} onChange={onChange} /><Field label="Téléphone" name="telephone" value={employee.telephone} onChange={onChange} required={false} />
      <Field label="Téléphone secondaire" name="telephone_secondaire" value={employee.telephone_secondaire || ""} onChange={onChange} required={false} />
      {(supervisor || accounting) && <Field label="Numéro d’employé" name="numero_employe" value={employee.numero_employe || ""} onChange={onChange} />}
      {!accounting && <Field label="Département" name="departement" value={employee.departement || ""} onChange={onChange} required={false} />}
      {accounting && <Field label="Service" name="service" value={employee.service || ""} onChange={onChange} required={false} />}
      {supervisor && <><Field label="Taux horaire" name="taux_horaire" type="number" step="0.001" min="0.001" value={employee.taux_horaire} onChange={onChange} /><Field label="Taux kilométrique" name="taux_kilometrique" type="number" step="0.001" min="0" value={employee.taux_kilometrique} onChange={onChange} /></>}
    </div><div className="modalActions managementModalActions"><button className="secondaryButton" type="button" disabled={saving} onClick={onCancel}>Annuler</button><button className="primaryButton" type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer les modifications"}</button></div></form>
  </div></div>;
}

function Field({ label, name, value, onChange, type = "text", required = true, ...props }) { return <label className={`managementField managementField-${name}`}><span>{label}{required ? " *" : ""}</span><input {...props} name={name} type={type} value={value} required={required} onChange={onChange} /></label>; }
function roleLabel(role) { return ({ SUPERVISEUR: "Superviseur", CONSEILLERE: "Conseillère", COMPTABILITE: "Comptabilité" })[role] || role; }
function authHeaders() { return { Authorization: `Bearer ${localStorage.getItem("token")}` }; }
