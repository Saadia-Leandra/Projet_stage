import { useEffect, useState } from "react";
import SupervisorStageRequests from "./SupervisorStageRequests.jsx";

const CAMPUS_OPTIONS = {
  MTL: {
    code: "MTL",
    label: "Campus de Montreal",
    address: "3030 rue Hochelaga Montreal QC H1W 1G2",
    distanceLabel: "Distance (km*2)"
  },
  BROSSARD: {
    code: "BROSSARD",
    label: "Campus Brossard",
    address: "4805 boulevard Lapiniere Brossard QC J4Z 0G2",
    distanceLabel: "Distance (km)"
  }
};

const DEFAULT_CAMPUS = CAMPUS_OPTIONS.MTL;

export default function SupervisorDashboard({ view, user }) {
  const [trips, setTrips] = useState([]);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSupervisorData() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    try {
      const tripsResponse = await fetch("/api/mileage/trips", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const tripsData = await tripsResponse.json().catch(() => ({}));

      if (!tripsResponse.ok) {
        setError(tripsData.error || "Impossible de charger les deplacements.");
        return;
      }

      setTrips(tripsData.trips || []);

      const studentsResponse = await fetch("/api/mileage/students", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const studentsData = await studentsResponse.json().catch(() => ({}));

      if (!studentsResponse.ok) {
        setError(studentsData.error || "Impossible de charger les etudiants.");
        return;
      }

      setStudents(studentsData.students || []);
      setError("");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function loadTrips() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/mileage/trips", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de charger les deplacements.");
        return;
      }

      setTrips(data.trips || []);
      setError("");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSupervisorData();
  }, []);

  const supervisorTrips = trips.filter((trip) => Number(trip.supervisorUserId) === Number(user.id));

  if (view === "stageRequests") {
    return <SupervisorStageRequests />;
  }

  if (view === "mileage") {
    return (
      <MileageView
        loading={loading}
        error={error}
        trips={supervisorTrips}
        students={students}
        user={user}
        onCreated={loadTrips}
      />
    );
  }

  return <SupervisorOverview user={user} trips={supervisorTrips} loading={loading} error={error} />;
}

function SupervisorOverview({ user, trips, loading, error }) {
  const totalKm = trips.reduce((sum, trip) => sum + Number(trip.distanceKm || 0), 0);
  const totalAmount = trips.reduce((sum, trip) => sum + Number(trip.reimbursementAmount || 0), 0);

  return (
    <>
      {error && <div className="studentError">{error}</div>}
      <section className="panel">
        <div className="panelHeader">
          <h2>Profil connecte</h2>
          <span className="statusPill">Superviseur</span>
        </div>

        <div className="stageInfo">
          <div>
            <strong>Courriel</strong>
            <span>{user.email}</span>
          </div>
          <div>
            <strong>Numero employe</strong>
            <span>{user.employeeNumber || "-"}</span>
          </div>
          <div>
            <strong>Statut</strong>
            <span>{user.status}</span>
          </div>
        </div>
      </section>

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Resume kilometrage</h2>
          {loading && <span className="statusPill">Chargement</span>}
        </div>

        <div className="stageInfo">
          <div>
            <strong>Deplacements</strong>
            <span>{trips.length}</span>
          </div>
          <div>
            <strong>Kilometres</strong>
            <span>{formatNumber(totalKm)} km</span>
          </div>
          <div>
            <strong>Remboursements</strong>
            <span>{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      </section>
    </>
  );
}

function MileageView({ loading, error, trips, students, user, onCreated }) {
  return (
    <>
      {error && <div className="studentError">{error}</div>}
      <MileageForm user={user} students={students} onCreated={onCreated} />
      <MileageTripsTable loading={loading} trips={trips} />
    </>
  );
}

function MileageForm({ user, students, onCreated }) {
  const [form, setForm] = useState({
    studentId: "",
    campus: DEFAULT_CAMPUS.code,
    origin: DEFAULT_CAMPUS.address,
    program: "",
    group: "",
    tripDate: new Date().toISOString().slice(0, 10),
    studentName: "",
    companyName: "",
    destinationAddress: "",
    tripType: "ALLER_RETOUR",
    ratePerKm: user.mileageRate ? String(user.mileageRate) : "",
    parkingAmount: "0",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [calculation, setCalculation] = useState(null);

  const selectedCampus = CAMPUS_OPTIONS[form.campus] || DEFAULT_CAMPUS;
  const reimbursementPreview = calculation
    ? Number(calculation.distanceKm || 0) * Number(form.ratePerKm || 0) + Number(form.parkingAmount || 0)
    : 0;

  useEffect(() => {
    if (user.mileageRate) {
      setForm((current) => ({
        ...current,
        ratePerKm: String(user.mileageRate)
      }));
    }
  }, [user.mileageRate]);

  function updateField(event) {
    const { name, value } = event.target;

    if (name === "studentId") {
      const student = students.find((item) => String(item.id) === value);

      if (!student) {
        setForm((current) => ({
          ...current,
          studentId: "",
          studentName: "",
          companyName: "",
          destinationAddress: "",
          program: "",
          group: ""
        }));
        return;
      }

      setForm((current) => ({
        ...current,
        studentId: value,
        studentName: student.studentName || "",
        companyName: student.companyName || "",
        destinationAddress: formatCompanyAddress(student),
        program: student.program || "",
        group: student.groupe || ""
      }));
      return;
    }

    if (name === "campus") {
      const campus = CAMPUS_OPTIONS[value] || DEFAULT_CAMPUS;
      setForm((current) => ({
        ...current,
        campus: campus.code,
        origin: campus.address
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    setCalculation(null);

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree. Veuillez vous reconnecter.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/mileage/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          parkingAmount: Number(form.parkingAmount),
          destinations: [
            {
              companyId: selectedStudentCompanyId(students, form.studentId),
              label: form.companyName || form.studentName || "Destination",
              address: form.destinationAddress
            }
          ]
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de calculer le kilometrage.");
        return;
      }

      setForm((current) => ({
        ...current,
        ratePerKm: String(data.ratePerKm ?? current.ratePerKm)
      }));
      setCalculation(data);
      setMessage("Deplacement calcule et enregistre.");
      await onCreated();
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Remboursement des deplacements</h2>
        <span className="statusPill">{selectedCampus.label}</span>
      </div>

      {error && <div className="studentError">{error}</div>}
      {message && <div className="studentSuccess">{message}</div>}

      <form className="studentForm mileageForm" onSubmit={submitForm}>
        <h3>Identification</h3>
        <div className="studentFormGrid">
          <label className="field wide">
            Etudiant
            <select name="studentId" value={form.studentId} onChange={updateField} required>
              <option value="">Choisir un etudiant</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentName} - {student.studentCode}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Campus de depart
            <select name="campus" value={form.campus} onChange={updateField} required>
              {Object.values(CAMPUS_OPTIONS).map((campus) => (
                <option key={campus.code} value={campus.code}>
                  {campus.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Enseignant
            <input value={displayName(user)} readOnly />
          </label>

          <label className="field wide">
            Adresse de depart
            <input value={form.origin} readOnly />
          </label>

          <label className="field">
            Programme
            <input name="program" value={form.program} onChange={updateField} />
          </label>

          <label className="field">
            Groupe
            <input name="group" value={form.group} onChange={updateField} />
          </label>

          <label className="field wide">
            Entreprise
            <input name="companyName" value={form.companyName} onChange={updateField} required />
          </label>
        </div>

        <h3>Deplacement</h3>
        <div className="studentFormGrid">
          <label className="field">
            Date
            <input name="tripDate" type="date" value={form.tripDate} onChange={updateField} required />
          </label>

          <label className="field">
            Nom de l'etudiant
            <input
              name="studentName"
              value={form.studentName}
              onChange={updateField}
              required
            />
          </label>

          <label className="field wide">
            Adresse de destination
            <input
              name="destinationAddress"
              value={form.destinationAddress}
              onChange={updateField}
              placeholder="Numero, rue, ville, code postal"
              required
            />
          </label>

          <label className="field">
            Type de trajet
            <select name="tripType" value={form.tripType} onChange={updateField}>
              <option value="ALLER_RETOUR">Aller-retour</option>
              <option value="ALLER_SIMPLE">Aller simple</option>
            </select>
          </label>

          <label className="field">
            Taux / km
            <input
              name="ratePerKm"
              type="number"
              min="0"
              step="0.001"
              value={form.ratePerKm}
              readOnly
              required
            />
          </label>

          <label className="field">
            Stationnement
            <input
              name="parkingAmount"
              type="number"
              min="0"
              step="0.01"
              value={form.parkingAmount}
              onChange={updateField}
            />
          </label>
        </div>

        {calculation && (
          <div className="mileageResult">
            <strong>{selectedCampus.distanceLabel}: {formatNumber(calculation.distanceKm)} km</strong>
            <span>Total: {formatCurrency(reimbursementPreview)}</span>
            <span>{calculation.durationLabel || `${formatNumber(calculation.durationMinutes)} min`}</span>
            {calculation.mapUrl && (
              <a href={calculation.mapUrl} target="_blank" rel="noreferrer">
                Voir l'itineraire
              </a>
            )}
          </div>
        )}

        <button className="primaryButton fitButton" type="submit" disabled={submitting || !form.ratePerKm}>
          {submitting ? "Calcul en cours..." : "Calculer et enregistrer"}
        </button>
      </form>
    </section>
  );
}

function MileageTripsTable({ loading, trips }) {
  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Historique kilometrage</h2>
        <span className="statusPill">{loading ? "Chargement" : `${trips.length} deplacement(s)`}</span>
      </div>

      <div className="studentTableWrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Campus</th>
              <th>Programme</th>
              <th>Trajet</th>
              <th>Distance</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => (
              <tr key={trip.id}>
                <td>{formatDate(trip.tripDate)}</td>
                <td>{trip.campusCode || trip.campusName || "-"}</td>
                <td>{trip.program || "-"}</td>
                <td>{trip.tripType === "ALLER_SIMPLE" ? "Aller simple" : "Aller-retour"}</td>
                <td>{formatNumber(trip.distanceKm)} km</td>
                <td>{formatCurrency(trip.reimbursementAmount)}</td>
                <td><span className="statusPill statusGreen">{trip.status || "CALCULE"}</span></td>
              </tr>
            ))}

            {!trips.length && (
              <tr>
                <td colSpan="7">Aucun deplacement calcule pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
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

function formatCompanyAddress(student) {
  return [student.companyAddress, student.companyCity, student.companyPostalCode]
    .filter(Boolean)
    .join(" ");
}

function selectedStudentCompanyId(students, studentId) {
  const student = students.find((item) => String(item.id) === String(studentId));

  return student?.companyId || null;
}
