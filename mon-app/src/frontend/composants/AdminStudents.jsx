import { useEffect, useMemo, useState } from "react";
import { dedupeStudents } from "../utils/dedupeStudents.js";

const EMPTY_FORM = {
  userId: null,
  code_etudiant: "",
  nom: "",
  prenom: "",
  courriel: "",
  telephone: "",
  telephone_secondaire: "",
  superviseur_id: "",
  programme: "",
  cohorte: "",
  adresse: "",
  ville: "",
  province: "",
  code_postal: "",
  code_permanent: "",
  groupe: "",
  session: "",
  numero_cours: "",
  titre_cours: "",
  discipline: "",
  horaire: "",
  ponderation: "",
  expiration_caq: "",
  expiration_permis_etudes: "",
  expiration_assurance: "",
  date_debut_groupe: "",
  date_fin_groupe: ""
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filters, setFilters] = useState({ search: "", course: "", session: "", status: "" });

  const courses = useMemo(() => [...new Set(students
    .map((student) => student.numero_cours || student.titre_cours || student.programme)
    .filter(Boolean))].sort(), [students]);
  const sessions = useMemo(() => [...new Set(students.map((student) => student.session).filter(Boolean))].sort(), [students]);
  const filteredStudents = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("fr-CA");
    return students.filter((student) => {
      const course = student.numero_cours || student.titre_cours || student.programme || "";
      const identity = [student.nom, student.prenom, student.code_etudiant, student.courriel]
        .filter(Boolean).join(" ").toLocaleLowerCase("fr-CA");
      return (!search || identity.includes(search))
        && (!filters.course || course === filters.course)
        && (!filters.session || student.session === filters.session)
        && (!filters.status || student.statut === filters.status);
    });
  }, [students, filters]);

  async function loadStudents() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/students", {
        headers: authHeaders()
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Impossible de charger les étudiants.");
      }

      setStudents(dedupeStudents(data.students));
      setSupervisors(data.supervisors || []);
    } catch (loadError) {
      setError(loadError.message || "Impossible de charger les étudiants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    if (!success) return undefined;

    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [success]);

  function openEdit(student) {
    setError("");
    setSuccess("");
    setEditingStudent({
      ...EMPTY_FORM,
      ...student,
      telephone: student.telephone || "",
      telephone_secondaire: student.telephone_secondaire || "",
      superviseur_id: student.superviseur_id || "",
      expiration_caq: dateValue(student.expiration_caq),
      expiration_permis_etudes: dateValue(student.expiration_permis_etudes),
      expiration_assurance: dateValue(student.expiration_assurance),
      date_debut_groupe: dateValue(student.date_debut_groupe),
      date_fin_groupe: dateValue(student.date_fin_groupe)
    });
  }

  function updateField(event) {
    const { name, value } = event.target;
    setEditingStudent((student) => ({ ...student, [name]: value }));
  }

  async function saveStudent(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/admin/students/${editingStudent.userId}`,
        {
          method: "PUT",
          headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify(editingStudent)
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Impossible de modifier cet étudiant.");
      }

      setEditingStudent(null);
      setSuccess("Les informations de l’étudiant ont été modifiées.");
      await loadStudents();
    } catch (saveError) {
      setError(saveError.message || "Impossible de modifier cet étudiant.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStudentStatus(student) {
    const isActive = student.statut === "ACTIF";
    const nextStatus = isActive ? "INACTIF" : "ACTIF";
    const fullName = `${student.prenom} ${student.nom}`.trim();
    const confirmed = window.confirm(
      isActive
        ? `Voulez-vous archiver ${fullName || "cet étudiant"} ? Ses dossiers et historiques seront conservés.`
        : `Voulez-vous réactiver ${fullName || "cet étudiant"} ?`
    );

    if (!confirmed) return;

    setStatusLoadingId(student.userId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/students/${student.userId}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Impossible de modifier le statut de cet étudiant.");
      }

      setStudents((current) => current.map((item) =>
        item.userId === student.userId ? { ...item, statut: nextStatus } : item
      ));
      setSuccess(isActive ? "L’étudiant a été archivé." : "L’étudiant a été réactivé.");
    } catch (statusError) {
      setError(statusError.message || "Impossible de modifier le statut de cet étudiant.");
    } finally {
      setStatusLoadingId(null);
    }
  }

  return (
    <section className="panel adminStudents">
      <div className="panelHeader">
        <div>
          <h2>Liste des étudiants créés</h2>
          <p className="panelSubtle">
            {filteredStudents.length} étudiant(s) trouvé(s) sur {students.length}
          </p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {!loading && students.length > 0 && <div className="managementStats">
        <div><span>Total</span><strong>{students.length}</strong></div>
        <div><span>Actifs</span><strong>{students.filter((student) => student.statut === "ACTIF").length}</strong></div>
        <div><span>Archivés</span><strong>{students.filter((student) => student.statut !== "ACTIF").length}</strong></div>
      </div>}

      {!loading && students.length > 0 && (
        <div className="adminStudentFilters managementToolbar">
          <label className="managementSearch"><span>Rechercher</span><input name="search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Nom, courriel ou numéro de dossier" /></label>
          <label><span>Cours</span><select name="course" value={filters.course} onChange={(event) => setFilters((current) => ({ ...current, course: event.target.value }))}><option value="">Tous les cours</option>{courses.map((course) => <option key={course} value={course}>{course}</option>)}</select></label>
          <label><span>Session</span><select name="session" value={filters.session} onChange={(event) => setFilters((current) => ({ ...current, session: event.target.value }))}><option value="">Toutes les sessions</option>{sessions.map((session) => <option key={session} value={session}>{session}</option>)}</select></label>
          <label><span>Statut</span><select name="status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Tous</option><option value="ACTIF">Actifs</option><option value="INACTIF">Archivés</option></select></label>
          <button className="secondaryButton fitButton" type="button" onClick={() => setFilters({ search: "", course: "", session: "", status: "" })}>Réinitialiser</button>
        </div>
      )}

      {loading ? (
        <p>Chargement des étudiants...</p>
      ) : students.length === 0 ? (
        <p className="emptyState">Aucun étudiant n’a encore été créé.</p>
      ) : (
        <div className="studentTableWrap">
          <table>
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Coordonnées</th>
                <th>Parcours</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.userId}>
                  <td><div className="studentIdentity"><span className="studentAvatar">{initials(student)}</span><span><strong>{student.prenom} {student.nom}</strong><small>{student.code_etudiant}</small></span></div></td>
                  <td><strong className="tablePrimaryText">{student.courriel}</strong><span className="tableSubtext">{student.telephone || "Aucun téléphone"}</span></td>
                  <td><strong className="tablePrimaryText">{student.numero_cours || student.programme || "—"}</strong><span className="tableSubtext">{[student.session, student.groupe].filter(Boolean).join(" · ") || "Non précisé"}</span></td>
                  <td>
                    <span
                      className={`statusPill ${
                        student.statut === "ACTIF" ? "statusGreen" : ""
                      }`}
                    >
                      {student.statut}
                    </span>
                  </td>
                  <td>
                    <div className="tableActions">
                      <button
                        className="secondaryButton fitButton"
                        type="button"
                        onClick={() => openEdit(student)}
                      >
                        Modifier
                      </button>
                      <button
                        className={`${student.statut === "ACTIF" ? "dangerButton" : "secondaryButton"} fitButton`}
                        type="button"
                        disabled={statusLoadingId === student.userId}
                        onClick={() => changeStudentStatus(student)}
                      >
                        {statusLoadingId === student.userId
                          ? "Enregistrement..."
                          : student.statut === "ACTIF" ? "Archiver" : "Réactiver"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredStudents.length && <tr><td colSpan="5"><div className="emptyState"><strong>Aucun étudiant trouvé</strong><span>Modifiez les critères ou réinitialisez les filtres.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          supervisors={supervisors}
          saving={saving}
          onChange={updateField}
          onCancel={() => setEditingStudent(null)}
          onSubmit={saveStudent}
        />
      )}
    </section>
  );
}

function EditStudentModal({
  student,
  supervisors,
  saving,
  onChange,
  onCancel,
  onSubmit
}) {
  return (
    <div className="modalOverlay">
      <div
        className="modalCard adminStudentModal managementModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title"
      >
        <div className="panelHeader managementModalHeader">
          <div>
            <span className="managementModalEyebrow">Dossier étudiant</span>
            <h2 id="edit-student-title">Modifier l’étudiant</h2>
            <p className="panelSubtle">
              {student.prenom} {student.nom} · {student.code_etudiant}
            </p>
          </div>
          <button
            className="modalCloseButton"
            type="button"
            aria-label="Fermer"
            disabled={saving}
            onClick={onCancel}
          >
            ×
          </button>
        </div>

        <form className="authForm managementForm" onSubmit={onSubmit}>
          <div className="managementFormIntro">
            <strong>Informations du dossier</strong>
            <span>Les champs marqués d’un astérisque sont requis.</span>
          </div>
          <div className="formGrid">
            <Field
              label="Numéro de dossier"
              name="code_etudiant"
              value={student.code_etudiant}
              onChange={onChange}
            />
            <Field
              label="Prénom"
              name="prenom"
              value={student.prenom}
              onChange={onChange}
            />
            <Field
              label="Nom"
              name="nom"
              value={student.nom}
              onChange={onChange}
            />
            <Field
              label="Courriel"
              name="courriel"
              type="email"
              value={student.courriel}
              onChange={onChange}
            />
            <Field
              label="Téléphone"
              name="telephone"
              type="tel"
              value={student.telephone}
              onChange={onChange}
              required={false}
            />
            <Field label="Téléphone secondaire" name="telephone_secondaire" type="tel" value={student.telephone_secondaire || ""} onChange={onChange} required={false} />
            <label>
              <span>Superviseur de stage</span>
              <select name="superviseur_id" value={student.superviseur_id || ""} onChange={onChange}>
                <option value="">Aucun superviseur</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.userId} value={supervisor.userId}>{supervisor.prenom} {supervisor.nom} ({supervisor.numero_employe})</option>
                ))}
              </select>
            </label>
            <Field label="Programme" name="programme" value={student.programme || ""} onChange={onChange} />
            <Field label="Cohorte" name="cohorte" value={student.cohorte || ""} onChange={onChange} required={false} />
            <Field label="Code permanent" name="code_permanent" value={student.code_permanent || ""} onChange={onChange} required={false} />
            <Field label="Groupe / grille" name="groupe" value={student.groupe || ""} onChange={onChange} required={false} />
            <Field label="Adresse" name="adresse" value={student.adresse || ""} onChange={onChange} required={false} />
            <Field label="Ville" name="ville" value={student.ville || ""} onChange={onChange} required={false} />
            <Field label="Province" name="province" value={student.province || ""} onChange={onChange} required={false} />
            <Field label="Code postal" name="code_postal" value={student.code_postal || ""} onChange={onChange} required={false} />
            <Field label="Session" name="session" value={student.session || ""} onChange={onChange} required={false} />
            <Field label="Numéro du cours" name="numero_cours" value={student.numero_cours || ""} onChange={onChange} required={false} />
            <Field label="Titre du cours" name="titre_cours" value={student.titre_cours || ""} onChange={onChange} required={false} />
            <Field label="Discipline" name="discipline" value={student.discipline || ""} onChange={onChange} required={false} />
            <Field label="Horaire" name="horaire" value={student.horaire || ""} onChange={onChange} required={false} />
            <Field label="Pondération" name="ponderation" value={student.ponderation || ""} onChange={onChange} required={false} />
            <Field label="Expiration du CAQ" name="expiration_caq" type="date" value={dateValue(student.expiration_caq)} onChange={onChange} required={false} />
            <Field label="Expiration du permis d’études" name="expiration_permis_etudes" type="date" value={dateValue(student.expiration_permis_etudes)} onChange={onChange} required={false} />
            <Field label="Expiration de l’assurance" name="expiration_assurance" type="date" value={dateValue(student.expiration_assurance)} onChange={onChange} required={false} />
            <Field label="Début du groupe" name="date_debut_groupe" type="date" value={dateValue(student.date_debut_groupe)} onChange={onChange} required={false} />
            <Field label="Fin du groupe" name="date_fin_groupe" type="date" value={dateValue(student.date_fin_groupe)} onChange={onChange} required={false} />
          </div>

          <div className="modalActions managementModalActions">
            <button
              className="secondaryButton"
              type="button"
              disabled={saving}
              onClick={onCancel}
            >
              Annuler
            </button>
            <button className="primaryButton" type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = true
}) {
  return (
    <label className={`managementField managementField-${name}`}>
      <span>{label}{required ? " *" : ""}</span>
      <input
        name={name}
        type={type}
        value={value}
        required={required}
        onChange={onChange}
      />
    </label>
  );
}

function authHeaders() {
  return {
    Authorization: `Bearer ${localStorage.getItem("token")}`
  };
}

function dateValue(value) {
  return value ? String(value).slice(0, 10) : "";
}

function initials(student) {
  return `${student.prenom?.[0] || ""}${student.nom?.[0] || ""}`.toUpperCase() || "?";
}
