import { useEffect, useState } from "react";

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

      setStudents(data.students || []);
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
      superviseur_id: student.superviseur_id || ""
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
            {students.length} étudiant(s) enregistré(s)
          </p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {loading ? (
        <p>Chargement des étudiants...</p>
      ) : students.length === 0 ? (
        <p className="emptyState">Aucun étudiant n’a encore été créé.</p>
      ) : (
        <div className="studentTableWrap">
          <table>
            <thead>
              <tr>
                <th>Dossier</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Courriel</th>
                <th>Téléphone</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.userId}>
                  <td>{student.code_etudiant}</td>
                  <td>{student.nom}</td>
                  <td>{student.prenom}</td>
                  <td>{student.courriel}</td>
                  <td>{student.telephone || "—"}</td>
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
