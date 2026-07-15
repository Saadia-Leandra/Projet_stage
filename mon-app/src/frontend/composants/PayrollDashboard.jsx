import { useEffect, useMemo, useState } from "react";

const FIXED_SUPERVISION_HOURS = 4;

export default function PayrollDashboard({ user }) {
  const [supervisors, setSupervisors] = useState([]);
  const [charges, setCharges] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const totals = useMemo(() => {
    return supervisors.reduce(
      (sum, supervisor) => ({
        supervisionAmount: sum.supervisionAmount + Number(supervisor.supervisionAmount || 0),
        mileageAmount: sum.mileageAmount + Number(supervisor.mileageAmount || 0),
        totalAmount: sum.totalAmount + Number(supervisor.totalAmount || 0)
      }),
      { supervisionAmount: 0, mileageAmount: 0, totalAmount: 0 }
    );
  }, [supervisors]);

  async function loadPayroll() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    try {
      const [supervisorsResponse, chargesResponse] = await Promise.all([
        fetch("/api/payroll/supervisors", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch("/api/payroll/supervision-charges", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const supervisorsData = await supervisorsResponse.json().catch(() => ({}));
      const chargesData = await chargesResponse.json().catch(() => ({}));

      if (!supervisorsResponse.ok) {
        setError(supervisorsData.error || "Impossible de charger les totaux de paie.");
        return;
      }

      if (!chargesResponse.ok) {
        setError(chargesData.error || "Impossible de charger les charges de paie.");
        return;
      }

      setSupervisors(supervisorsData.supervisors || []);
      setCharges(chargesData.charges || []);
      setError("");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    if (user.role !== "SUPERVISEUR") {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree. Veuillez vous reconnecter.");
      return;
    }

    try {
      const response = await fetch("/api/payroll/settings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de charger les informations de paie.");
        return;
      }

      setSettings(data);
    } catch {
      setError("Erreur de connexion au serveur.");
    }
  }

  useEffect(() => {
    loadPayroll();
    loadSettings();
  }, []);

  async function updateStatus(chargeId, status) {
    const token = localStorage.getItem("token");
    setActionLoadingId(chargeId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/payroll/supervision-charges/${chargeId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de mettre a jour la charge.");
        return;
      }

      setMessage(status === "VALIDE" ? "Charge validee." : "Charge rejetee.");
      await loadPayroll();
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const canValidate = ["COMPTABILITE", "DIRECTION"].includes(user.role);

  return (
    <>
      {error && <div className="studentError">{error}</div>}
      {message && <div className="studentSuccess">{message}</div>}

      {user.role === "SUPERVISEUR" && (
        <PayrollChargeForm
          settings={settings}
          user={user}
          onCreated={async () => {
            setMessage("Charge de stage creee.");
            await loadPayroll();
          }}
          onError={setError}
        />
      )}

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Charges de stage a payer</h2>
          {loading && <span className="statusPill">Chargement</span>}
        </div>

        <div className="stageInfo">
          <div>
            <strong>Supervision</strong>
            <span>{formatCurrency(totals.supervisionAmount)}</span>
          </div>
          <div>
            <strong>Kilometrage</strong>
            <span>{formatCurrency(totals.mileageAmount)}</span>
          </div>
          <div>
            <strong>Total paie</strong>
            <span>{formatCurrency(totals.totalAmount)}</span>
          </div>
        </div>
      </section>

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Resume par superviseur</h2>
          <span className="statusPill">{supervisors.length} superviseur(s)</span>
        </div>

        <div className="studentTableWrap">
          <table>
            <thead>
              <tr>
                <th>Superviseur</th>
                <th>Etudiants</th>
                <th>Heures</th>
                <th>Supervision</th>
                <th>Kilometrage</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {supervisors.map((supervisor) => (
                <tr key={supervisor.supervisorUserId}>
                  <td>
                    <strong>{supervisor.supervisorName}</strong>
                    <span className="tableSubtext">{supervisor.employeeNumber || supervisor.supervisorEmail}</span>
                  </td>
                  <td>{formatNumber(supervisor.studentCount)}</td>
                  <td>{formatNumber(supervisor.supervisionHours)}</td>
                  <td>{formatCurrency(supervisor.supervisionAmount)}</td>
                  <td>
                    {formatCurrency(supervisor.mileageAmount)}
                    <span className="tableSubtext">{formatNumber(supervisor.distanceKm)} km</span>
                  </td>
                  <td><strong>{formatCurrency(supervisor.totalAmount)}</strong></td>
                </tr>
              ))}

              {!supervisors.length && (
                <tr>
                  <td colSpan="6">Aucun montant de paie a afficher.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Liste des stagiaires supervises</h2>
          <span className="statusPill">{charges.length} charge(s)</span>
        </div>

        <div className="studentTableWrap">
          <table>
            <thead>
              <tr>
                <th>Demande</th>
                <th>Superviseur</th>
                <th>Etudiant</th>
                <th>Heures</th>
                <th>Taux</th>
                <th>Total</th>
                <th>Statut</th>
                {canValidate && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={charge.id}>
                  <td>{formatDate(charge.createdAt)}</td>
                  <td>{charge.supervisorName}</td>
                  <td>
                    <strong>{charge.studentName}</strong>
                    <span className="tableSubtext">{charge.studentCode}</span>
                  </td>
                  <td>{formatNumber(charge.supervisionHours)}</td>
                  <td>{formatCurrency(charge.hourlyRate)}</td>
                  <td><strong>{formatCurrency(charge.totalAmount)}</strong></td>
                  <td><span className={`statusPill ${statusClass(charge.status)}`}>{statusLabel(charge.status)}</span></td>
                  {canValidate && (
                    <td>
                      <div className="tableActions">
                        <button
                          className="secondaryButton fitButton"
                          type="button"
                          disabled={actionLoadingId === charge.id}
                          onClick={() => updateStatus(charge.id, "VALIDE")}
                        >
                          Valider
                        </button>
                        <button
                          className="dangerButton fitButton"
                          type="button"
                          disabled={actionLoadingId === charge.id}
                          onClick={() => updateStatus(charge.id, "REJETE")}
                        >
                          Rejeter
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {!charges.length && (
                <tr>
                  <td colSpan={canValidate ? "8" : "7"}>Aucune charge de supervision pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function PayrollChargeForm({ settings, user, onCreated, onError }) {
  const [form, setForm] = useState({
    courseTitle: "",
    courseCodeGroup: "",
    session: "",
    studentCode: "",
    comment: ""
  });
  const [submitting, setSubmitting] = useState(false);

  const students = settings?.students || [];
  const selectedStudent = students.find((student) => student.studentCode === form.studentCode);
  const courseTitles = [...new Set(students.map((student) => student.program).filter(Boolean))];
  const availableGroups = [...new Set(students
    .filter((student) => student.program === form.courseTitle)
    .map((student) => student.groupName)
    .filter(Boolean))];
  const hourlyRate = Number(settings?.hourlyRate || 0);
  const totalAmount = FIXED_SUPERVISION_HOURS * hourlyRate;

  function updateField(event) {
    const { name, value } = event.target;
    const student = name === "studentCode"
      ? students.find((item) => item.studentCode === value)
      : null;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "courseTitle" ? { courseCodeGroup: "", studentCode: "" } : {}),
      ...(name === "courseCodeGroup" ? { studentCode: "" } : {}),
      ...(student ? {
        courseTitle: student.program || "",
        courseCodeGroup: student.groupName || ""
      } : {})
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    const token = localStorage.getItem("token");

    setSubmitting(true);
    onError("");

    try {
      const response = await fetch("/api/payroll/supervision-charges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        onError(data.error || "Impossible de creer la charge de stage.");
        return;
      }

      setForm({
        courseTitle: "",
        courseCodeGroup: "",
        session: "",
        studentCode: "",
        comment: ""
      });
      await onCreated();
    } catch {
      onError("Erreur de connexion au serveur.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Charge de stage a payer</h2>
        <span className="statusPill">Saisie superviseur</span>
      </div>

      <form className="studentForm" onSubmit={submitForm}>
        <h3>Identification</h3>
        <div className="studentFormGrid">
          <label className="field wide">
            Nom, prenom(s) enseignant
            <input value={settings?.supervisorName || displayName(user)} readOnly />
          </label>

          <label className="field">
            Numero et nom de cours
            <select
              name="courseTitle"
              value={form.courseTitle}
              onChange={updateField}
              required
              disabled={!settings}
            >
              <option value="">Selectionner un cours</option>
              {courseTitles.map((courseTitle) => (
                <option key={courseTitle} value={courseTitle}>{courseTitle}</option>
              ))}
            </select>
          </label>

          <label className="field">
            Code du cours et no de groupe
            <select
              name="courseCodeGroup"
              value={form.courseCodeGroup}
              onChange={updateField}
              required
              disabled={!form.courseTitle}
            >
              <option value="">Selectionner un groupe</option>
              {availableGroups.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Session
            <input
              name="session"
              value={form.session}
              onChange={updateField}
              placeholder="Ex.: Ete 2026"
            />
          </label>

          <label className="field">
            Nombre d'etudiants
            <input value={form.studentCode ? "1" : "0"} readOnly />
          </label>
        </div>

        <h3>Liste des stagiaires supervises</h3>
        <div className="studentFormGrid">
          <label className="field wide">
            Etudiant
            <select
              name="studentCode"
              value={form.studentCode}
              onChange={updateField}
              required
              disabled={!settings}
            >
              <option value="">Selectionner un etudiant</option>
              {(settings?.students || []).map((student) => (
                <option key={student.studentCode} value={student.studentCode}>
                  {student.studentCode} - {student.studentName}
                </option>
              ))}
            </select>
          </label>

          {selectedStudent && (
            <div className="formContext wide">
              <span>{selectedStudent.program || "-"}</span>
              <span>{selectedStudent.groupName || "-"}</span>
            </div>
          )}

          <label className="field">
            Nombre d'heures par etudiant
            <input value={`${FIXED_SUPERVISION_HOURS} h`} readOnly />
          </label>

          <label className="field">
            Nombre total d'heures supervisees
            <input value={form.studentCode ? `${FIXED_SUPERVISION_HOURS} h` : "0 h"} readOnly />
          </label>

          <label className="field">
            Taux horaire
            <input value={settings ? formatCurrency(hourlyRate) : "Chargement..."} readOnly />
          </label>

          <label className="field">
            Total
            <input value={formatCurrency(totalAmount)} readOnly />
          </label>

          <label className="field wide">
            Commentaires supplementaires
            <textarea
              name="comment"
              value={form.comment}
              onChange={updateField}
              rows="3"
            />
          </label>
        </div>

        <button className="primaryButton fitButton" type="submit" disabled={submitting || !settings}>
          {submitting ? "Enregistrement..." : "Creer la charge"}
        </button>
      </form>
    </section>
  );
}

function statusLabel(status) {
  const labels = {
    CALCULE: "Calcule",
    VALIDE: "Valide",
    REJETE: "Rejete",
    EXPORTE: "Exporte"
  };

  return labels[status] || status || "-";
}

function statusClass(status) {
  if (status === "VALIDE" || status === "EXPORTE") {
    return "statusGreen";
  }

  if (status === "REJETE") {
    return "statusRed";
  }

  return "statusYellow";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("fr-CA");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-CA", {
    maximumFractionDigits: 2
  });
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("fr-CA", {
    style: "currency",
    currency: "CAD"
  });
}

function displayName(user) {
  return user?.fullName || user?.email?.split("@")[0] || "Utilisateur";
}
