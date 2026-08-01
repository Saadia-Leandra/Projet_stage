import { useEffect, useState } from "react";

const EMPTY_FORM = {
  userId: null,
  code_etudiant: "",
  nom: "",
  prenom: "",
  courriel: "",
  telephone: ""
};

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
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
      telephone: student.telephone || ""
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
  saving,
  onChange,
  onCancel,
  onSubmit
}) {
  return (
    <div className="modalOverlay">
      <div
        className="modalCard adminStudentModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-student-title"
      >
        <div className="panelHeader">
          <div>
            <h2 id="edit-student-title">Modifier l’étudiant</h2>
            <p className="panelSubtle">
              Modifiez les renseignements, puis enregistrez.
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

        <form className="authForm" onSubmit={onSubmit}>
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
          </div>

          <div className="modalActions">
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
    <label>
      <span>{label}</span>
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
