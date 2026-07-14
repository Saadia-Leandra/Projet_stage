import { useEffect, useState } from "react";

const emptyUser = () => ({ firstName: "", lastName: "", email: "", phone: "", password: "",
  role: "ETUDIANT", studentCode: "", permanentCode: "", program: "", employeeNumber: "", department: "" });

export default function UserManagement({ currentUserId }) {
  const [users, setUsers] = useState([]);
  const [forms, setForms] = useState([emptyUser()]);
  const [selected, setSelected] = useState([]);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  async function loadUsers() {
    try {
      const response = await apiFetch("/api/users");
      setUsers(response.users || []);
      setSelected([]);
    } catch (error) { setMessage({ type: "error", text: error.message }); }
  }

  useEffect(() => { loadUsers(); }, []);

  function updateForm(index, key, value) {
    setForms((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  async function create(event) {
    event.preventDefault(); setBusy(true); setMessage({ type: "", text: "" });
    try {
      const data = await apiFetch("/api/users", { method: "POST", body: JSON.stringify({ users: forms }) });
      setForms([emptyUser()]);
      setMessage({ type: "success", text: `${data.count} utilisateur${data.count > 1 ? "s" : ""} cree${data.count > 1 ? "s" : ""}.` });
      await loadUsers();
    } catch (error) { setMessage({ type: "error", text: error.message }); }
    finally { setBusy(false); }
  }

  async function removeSelected() {
    if (!selected.length || !window.confirm(`Supprimer definitivement ${selected.length} utilisateur(s) ?`)) return;
    setBusy(true); setMessage({ type: "", text: "" });
    try {
      const data = await apiFetch("/api/users", { method: "DELETE", body: JSON.stringify({ ids: selected }) });
      setMessage({ type: "success", text: `${data.count} utilisateur${data.count > 1 ? "s" : ""} supprime${data.count > 1 ? "s" : ""}.` });
      await loadUsers();
    } catch (error) { setMessage({ type: "error", text: error.message }); }
    finally { setBusy(false); }
  }

  function startEditing(user) {
    setEditing({ ...emptyUser(), ...user, password: "", phone: user.phone || "",
      studentCode: user.studentCode || "", permanentCode: user.permanentCode || "",
      program: user.program || "", employeeNumber: user.employeeNumber || "",
      department: user.department || "" });
    setMessage({ type: "", text: "" });
  }

  async function saveEdit(event) {
    event.preventDefault();
    const validationError = validateEditedUser(editing);
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }
    setBusy(true); setMessage({ type: "", text: "" });
    try {
      await apiFetch(`/api/users/${editing.id}`, { method: "PATCH", body: JSON.stringify(editing) });
      setEditing(null);
      setMessage({ type: "success", text: "Les informations de l'utilisateur ont ete modifiees." });
      await loadUsers();
    } catch (error) { setMessage({ type: "error", text: error.message }); }
    finally { setBusy(false); }
  }

  return <>
    {message.text && !editing && <div className={message.type === "error" ? "studentError" : "studentSuccess"} role="alert" aria-live="polite">{message.text}</div>}
    {editing && <section className="panel managementPanel">
      <div className="panelHeader"><div><h2>Modifier l'utilisateur</h2><p className="notice">Le role est conserve pour proteger ses donnees associees.</p></div>
        <button className="secondaryButton" type="button" onClick={() => setEditing(null)}>Annuler</button></div>
      <form className="managementForm" onSubmit={saveEdit} noValidate><fieldset className="managementCard"><legend>{editing.firstName} {editing.lastName}</legend>
        <div className="studentFormGrid">
          <Input label="Prenom *" value={editing.firstName} onChange={(v) => setEditing({ ...editing, firstName: v })} />
          <Input label="Nom *" value={editing.lastName} onChange={(v) => setEditing({ ...editing, lastName: v })} />
          <Input label="Courriel *" type="email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
          <Input label="Telephone" type="tel" value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
          <Input label="Nouveau mot de passe (facultatif)" type="password" minLength="8" value={editing.password} onChange={(v) => setEditing({ ...editing, password: v })} />
          <label className="field">Statut *<select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option value="ACTIF">Actif</option><option value="INACTIF">Inactif</option></select></label>
          {editing.role === "ETUDIANT" && <><Input label="Code etudiant *" value={editing.studentCode} onChange={(v) => setEditing({ ...editing, studentCode: v })} />
            <Input label="Code permanent" value={editing.permanentCode} onChange={(v) => setEditing({ ...editing, permanentCode: v })} />
            <Input label="Programme *" value={editing.program} onChange={(v) => setEditing({ ...editing, program: v })} /></>}
          {["SUPERVISEUR", "COMPTABILITE"].includes(editing.role) && <Input label="Numero d'employe *" value={editing.employeeNumber} onChange={(v) => setEditing({ ...editing, employeeNumber: v })} />}
          {editing.role !== "ETUDIANT" && <Input label={editing.role === "DIRECTION" ? "Titre" : editing.role === "COMPTABILITE" ? "Service" : "Departement"} value={editing.department} onChange={(v) => setEditing({ ...editing, department: v })} />}
        </div>
        {message.text && <div className={message.type === "error" ? "studentError" : "studentSuccess"} role="alert" aria-live="polite">{message.text}</div>}
        <button className="primaryButton fitButton" type="submit" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer les modifications"}</button>
      </fieldset></form>
    </section>}
    <section className="panel managementPanel">
      <div className="panelHeader"><div><h2>Creer des utilisateurs</h2><p className="notice">Vous pouvez enregistrer jusqu'a 100 comptes en une operation.</p></div>
        <button className="secondaryButton" type="button" onClick={() => setForms((items) => [...items, emptyUser()])}>+ Ajouter une fiche</button></div>
      <form className="managementForm" onSubmit={create}>
        {forms.map((form, index) => <fieldset className="managementCard" key={index}>
          <legend>Utilisateur {index + 1}</legend>
          {forms.length > 1 && <button className="removeCard" type="button" onClick={() => setForms((items) => items.filter((_, i) => i !== index))}>Retirer</button>}
          <div className="studentFormGrid">
            <Input label="Prenom *" value={form.firstName} onChange={(v) => updateForm(index, "firstName", v)} />
            <Input label="Nom *" value={form.lastName} onChange={(v) => updateForm(index, "lastName", v)} />
            <Input label="Courriel *" type="email" value={form.email} onChange={(v) => updateForm(index, "email", v)} />
            <Input label="Telephone" type="tel" value={form.phone} onChange={(v) => updateForm(index, "phone", v)} />
            <Input label="Mot de passe temporaire *" type="password" minLength="8" value={form.password} onChange={(v) => updateForm(index, "password", v)} />
            <label className="field">Role *<select value={form.role} onChange={(e) => updateForm(index, "role", e.target.value)}>
              <option value="ETUDIANT">Etudiant</option><option value="SUPERVISEUR">Superviseur</option><option value="CONSEILLERE">Conseillere</option>
              <option value="COMPTABILITE">Comptabilite</option><option value="DIRECTION">Direction</option></select></label>
            {form.role === "ETUDIANT" && <><Input label="Code etudiant *" value={form.studentCode} onChange={(v) => updateForm(index, "studentCode", v)} />
              <Input label="Code permanent" value={form.permanentCode} onChange={(v) => updateForm(index, "permanentCode", v)} />
              <Input label="Programme *" value={form.program} onChange={(v) => updateForm(index, "program", v)} /></>}
            {["SUPERVISEUR", "COMPTABILITE"].includes(form.role) && <Input label="Numero d'employe *" value={form.employeeNumber} onChange={(v) => updateForm(index, "employeeNumber", v)} />}
            {form.role !== "ETUDIANT" && <Input label={form.role === "DIRECTION" ? "Titre" : form.role === "COMPTABILITE" ? "Service" : "Departement"} value={form.department} onChange={(v) => updateForm(index, "department", v)} />}
          </div>
        </fieldset>)}
        <button className="primaryButton fitButton" disabled={busy}>Creer {forms.length > 1 ? "les utilisateurs" : "l'utilisateur"}</button>
      </form>
    </section>

    <section className="panel managementPanel"><div className="panelHeader"><h2>Utilisateurs existants</h2>
      <button className="dangerButton" type="button" disabled={busy || !selected.length} onClick={removeSelected}>Supprimer la selection ({selected.length})</button></div>
      <div className="studentTableWrap"><table><thead><tr><th></th><th>Nom</th><th>Courriel</th><th>Role</th><th>Statut</th><th>Action</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td><input aria-label={`Selectionner ${user.firstName} ${user.lastName}`} type="checkbox" disabled={Number(user.id) === Number(currentUserId)} checked={selected.includes(Number(user.id))} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, Number(user.id)] : ids.filter((id) => id !== Number(user.id)))} /></td>
          <td>{user.firstName} {user.lastName}{Number(user.id) === Number(currentUserId) && <small className="currentAccount">Vous</small>}</td><td>{user.email}</td><td>{roleLabel(user.role)}</td><td><span className="statusPill">{user.status}</span></td>
          <td><button className="secondaryButton" type="button" disabled={busy} onClick={() => startEditing(user)}>Modifier</button></td></tr>)}
        {!users.length && <tr><td colSpan="6">Aucun utilisateur.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}

function Input({ label, type = "text", value, onChange, ...props }) {
  return <label className="field">{label}<input {...props} type={type} value={value} required={label.endsWith("*")} onChange={(e) => onChange(e.target.value)} /></label>;
}

async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}`, ...options.headers } });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
    if (!response.ok) throw new Error(data.error || `La modification a echoue (erreur ${response.status}).`);
    if (!contentType.includes("application/json")) {
      throw new Error("Le serveur n'a pas charge la route de modification. Redemarrez le serveur puis reessayez.");
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("Le serveur ne repond pas. Redemarrez-le puis reessayez.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function validateEditedUser(user) {
  if (!user) return "Aucun utilisateur n'est selectionne.";
  if (!user.firstName.trim() || !user.lastName.trim() || !user.email.trim()) return "Le prenom, le nom et le courriel sont obligatoires.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim())) return "Le courriel est invalide.";
  if (user.password && user.password.length < 8) return "Le nouveau mot de passe doit contenir au moins 8 caracteres.";
  if (user.role === "ETUDIANT" && (!user.studentCode.trim() || !user.program.trim())) return "Le code etudiant et le programme sont obligatoires.";
  if (["SUPERVISEUR", "COMPTABILITE"].includes(user.role) && !user.employeeNumber.trim()) return "Le numero d'employe est obligatoire.";
  return "";
}

function roleLabel(role) { return ({ ETUDIANT: "Etudiant", SUPERVISEUR: "Superviseur", CONSEILLERE: "Conseillere", COMPTABILITE: "Comptabilite", DIRECTION: "Direction" })[role] || role; }
