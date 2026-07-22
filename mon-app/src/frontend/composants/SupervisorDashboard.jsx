import { useEffect, useState } from "react";
import SupervisorStageRequests from "./SupervisorStageRequests.jsx";
import { Fragment } from "react";
import FrozenRouteSnapshot from "./FrozenRouteSnapshot.jsx";

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

export default function SupervisorDashboard({ view, user, onNavigate }) {
  const [trips, setTrips] = useState([]);
  const [students, setStudents] = useState([]);
  const [stageRequests, setStageRequests] = useState([]);
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
      const requestsResponse = await fetch("/api/supervisor/stages/requests", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const requestsData = await requestsResponse.json().catch(() => ({}));
      if (requestsResponse.ok) setStageRequests(requestsData.requests || []);
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

  return <SupervisorOverview user={user} trips={supervisorTrips} requests={stageRequests} loading={loading} error={error} onNavigate={onNavigate} />;
}

function SupervisorOverview({ user, trips, requests, loading, error, onNavigate }) {
  const totalKm = trips.reduce((sum, trip) => sum + Number(trip.distanceKm || 0), 0);
  const totalAmount = trips.reduce((sum, trip) => sum + Number(trip.reimbursementAmount || 0), 0);
  const pendingRequests = requests.filter((request) => request.status === "SOUMISE");
  const latestPendingRequest = pendingRequests[0];
  const rejectedTrips = trips.filter((trip) => trip.status === "REJETE" && trip.refusalReason);
  const notificationCount = pendingRequests.length + rejectedTrips.length;

  return (
    <>
      {error && <div className="studentError">{error}</div>}
      <section className="studentHeroCard">
        <div className="studentHeroHeader">
          <div><h2>Mon espace enseignant</h2><p>{user.employeeNumber || "-"} - {user.email}</p></div>
          <span className="statusPill statusGreen">{user.status}</span>
        </div>
        <div className="studentInfo twoColumns">
          <div><strong>Etudiants supervises</strong><span>{requests.length}</span></div>
          <div><strong>Demandes a traiter</strong><span>{pendingRequests.length}</span></div>
          <div><strong>Deplacements</strong><span>{trips.length}</span></div>
          <div><strong>Kilometrage total</strong><span>{formatNumber(totalKm)} km</span></div>
        </div>
        <button className="secondaryButton studentActionButton" type="button" onClick={() => onNavigate("stageRequests")}>Voir les demandes de stage</button>
      </section>

      <div className="studentDashboardGrid">
        <section className="studentPanel">
          <div className="panelHeader"><h2>Resume kilometrage</h2>{loading && <span className="statusPill">Chargement</span>}</div>
          <div className="stageInfo">
            <div><strong>Deplacements</strong><span>{trips.length}</span></div>
            <div><strong>Kilometres</strong><span>{formatNumber(totalKm)} km</span></div>
            <div><strong>Remboursements</strong><span>{formatCurrency(totalAmount)}</span></div>
          </div>
          <button className="linkButton panelLink" type="button" onClick={() => onNavigate("mileage")}>Voir mes deplacements</button>
        </section>
        <section className="studentPanel">
          <div className="panelHeader"><h2>Notifications</h2><span className="statusPill">{notificationCount}</span></div>
          {rejectedTrips.slice(0, 3).map((trip) => <div className="notificationItem notificationRejected" key={`rejected-trip-${trip.id}`}>
            <span className="notificationDot" />
            <p><strong>Kilométrage du {formatDate(trip.tripDate)} refusé :</strong> {trip.refusalReason} <button className="proofLinkButton" type="button" onClick={() => onNavigate("mileage")}>Voir le trajet</button></p>
          </div>)}
          {latestPendingRequest && <div className="notificationItem"><span className="notificationDot" /><p>La demande de {latestPendingRequest.studentFullName} est en attente de validation.</p></div>}
          {!notificationCount && <div className="notificationItem"><p>Aucune nouvelle notification.</p></div>}
          {rejectedTrips.length > 3 && <p>{rejectedTrips.length - 3} autre(s) kilométrage(s) refusé(s).</p>}
          {pendingRequests.length > 1 && <p>{pendingRequests.length - 1} autre(s) demande(s) en attente.</p>}
        </section>
      </div>
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
    parkingAmount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [calculation, setCalculation] = useState(null);
  const [showRouteProof, setShowRouteProof] = useState(false);
  const [additionalStops, setAdditionalStops] = useState([]);
  const [parkingReceipt, setParkingReceipt] = useState(null);

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

    if (name === "parkingAmount" && Number(value || 0) <= 0) {
      setParkingReceipt(null);
    }

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

  function addStop() {
    if (additionalStops.length < 3) {
      setAdditionalStops((current) => [...current, { studentId: "", label: "", address: "" }]);
    }
  }

  function updateStop(index, field, value) {
    setAdditionalStops((current) => current.map((stop, stopIndex) => {
      if (stopIndex !== index) return stop;
      if (field !== "studentId") return { ...stop, [field]: value };
      const student = students.find((item) => String(item.id) === value);
      return { studentId: value, label: student?.studentName || "", address: formatCompanyAddress(student || {}) };
    }));
  }

  function removeStop(index) {
    setAdditionalStops((current) => current.filter((_, stopIndex) => stopIndex !== index));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    setCalculation(null);
    setShowRouteProof(false);

    if (Number(form.parkingAmount || 0) > 0 && !parkingReceipt) {
      setError("Le ticket de stationnement est obligatoire lorsqu’un montant de stationnement est indiqué.");
      setSubmitting(false);
      return;
    }

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
          parkingReceipt: parkingReceipt ? await fileToPayload(parkingReceipt) : null,
          destinations: [
            {
              companyId: selectedStudentCompanyId(students, form.studentId),
              label: form.companyName || form.studentName || "Destination",
              address: form.destinationAddress
            },
            ...additionalStops.map((stop) => ({
              companyId: selectedStudentCompanyId(students, stop.studentId),
              label: stop.label || "Destination",
              address: stop.address
            }))
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

          {additionalStops.map((stop, index) => (
            <div className="destinationRow wide" key={index}>
              <label className="field">Etudiant - arret {index + 2}
                <select value={stop.studentId} onChange={(event) => updateStop(index, "studentId", event.target.value)} required>
                  <option value="">Choisir un etudiant</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.studentName}</option>)}
                </select>
              </label>
              <label className="field">Adresse
                <input value={stop.address} onChange={(event) => updateStop(index, "address", event.target.value)} required />
              </label>
              <button className="dangerButton fitButton" type="button" onClick={() => removeStop(index)}>Retirer</button>
            </div>
          ))}
          {additionalStops.length < 3 && <button className="secondaryButton fitButton" type="button" onClick={addStop}>Ajouter une destination</button>}
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
            Frais de stationnement (facultatif)
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

        {Number(form.parkingAmount || 0) > 0 && <label className="field wide parkingUploadField">
          <span>Téléverser le ticket de stationnement <strong aria-hidden="true">*</strong></span>
          <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setParkingReceipt(event.target.files?.[0] || null)} />
          <small>{parkingReceipt ? `Fichier sélectionné : ${parkingReceipt.name}` : "Une image ou un PDF est obligatoire pour réclamer ces frais."}</small>
        </label>}
        {calculation && (
          <div className="mileageResult">
            <strong>{selectedCampus.distanceLabel}: {formatNumber(calculation.distanceKm)} km</strong>
            <span>Total: {formatCurrency(reimbursementPreview)}</span>
            <span>{calculation.durationLabel || `${formatNumber(calculation.durationMinutes)} min`}</span>
            {calculation.routeSnapshot && <button className="proofLinkButton" type="button" onClick={() => setShowRouteProof((visible) => !visible)}>{showRouteProof ? "Masquer l’itinéraire enregistré" : "Voir l’itinéraire enregistré"}</button>}
            {showRouteProof && <FrozenRouteSnapshot snapshot={calculation.routeSnapshot} tripId={calculation.tripId} currentMapUrl={calculation.mapUrl} />}
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
  const [expandedTripId, setExpandedTripId] = useState(null);

  async function openParkingReceipt(tripId) {
    const token = localStorage.getItem("token");
    const response = await fetch(`/api/mileage/trips/${tripId}/parking-receipt`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return;
    const receiptUrl = URL.createObjectURL(await response.blob());
    window.open(receiptUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(receiptUrl), 60000);
  }

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
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((trip) => {
              const snapshot = trip.routeSnapshot;
              const isExpanded = expandedTripId === trip.id;
              return <Fragment key={trip.id}>
                <tr>
                  <td>{formatDate(trip.tripDate)}</td><td>{trip.campusCode || trip.campusName || "-"}</td>
                  <td>{trip.program || "-"}</td><td>{trip.tripType === "ALLER_SIMPLE" ? "Aller simple" : "Aller-retour"}</td>
                  <td>{formatNumber(trip.distanceKm)} km</td><td>{formatCurrency(trip.reimbursementAmount)}</td>
                  <td><span className={`statusPill ${trip.status === "REJETE" ? "statusRed" : "statusGreen"}`}>{trip.status || "CALCULE"}</span>{trip.refusalReason && <span className="refusalReason"><strong>Motif :</strong> {trip.refusalReason}</span>}</td>
                  <td><button className="proofLinkButton" type="button" onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}>{isExpanded ? "Masquer l’itinéraire enregistré" : "Voir l’itinéraire enregistré"}</button></td>
                </tr>
                {isExpanded && <tr className="tripDetailsRow"><td colSpan="8">
                  {trip.status === "REJETE" && trip.refusalReason && <div className="mileageRefusalNotice" role="alert">
                    <strong>Kilométrage refusé</strong>
                    <span>{trip.refusalReason}</span>
                  </div>}
                  <div className="tripDetails">
                    <div><strong>Calcul effectué</strong><span>{formatDateTime(trip.calculatedAt)}</span></div>
                  </div>
                  <div className="tripDetailActions">
                    {trip.hasParkingReceipt && <button className="proofLinkButton" type="button" onClick={() => openParkingReceipt(trip.id)}>Voir le ticket de stationnement</button>}
                  </div>
                  <FrozenRouteSnapshot snapshot={snapshot} tripId={trip.id} currentMapUrl={trip.mapUrl} />
                </td></tr>}
              </Fragment>;
            })}

            {!trips.length && (
              <tr>
                <td colSpan="8">Aucun deplacement calcule pour le moment.</td>
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

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("fr-CA") : "-";
}



async function fileToPayload(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error("La preuve depasse 10 Mo.");
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = () => reject(new Error("Lecture de la preuve impossible."));
    reader.readAsDataURL(file);
  });
}


