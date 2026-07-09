import { useEffect, useMemo, useState } from "react";
import StudentRequestForm from "./StudentRequestForm.jsx";

export default function StudentDashboard({ view, onNavigate }) {
  const [student, setStudent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const latestRequest = useMemo(() => requests[0] || null, [requests]);

  async function loadDashboard() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/students/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de charger le tableau de bord.");
        return;
      }

      setStudent(data.student);
      setRequests(data.requests || []);
      setError("");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <>
      {error && <div className="studentError">{error}</div>}

      {view === "requests" && (
        <RequestsView
          loading={loading}
          student={student}
          requests={requests}
          onCreated={loadDashboard}
        />
      )}

      {view === "contracts" && <ContractsView requests={requests} onNavigate={onNavigate} />}

      {view === "dashboard" && (
        <OverviewView
          loading={loading}
          student={student}
          latestRequest={latestRequest}
          requests={requests}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}

function OverviewView({ loading, student, latestRequest, requests, onNavigate }) {
  return (
    <>
      <section className="studentHeroCard">
        <div className="studentHeroHeader">
          <div>
            <h2>Mon dossier de stage</h2>
            <p>{student?.studentCode || "-"} - {student?.programme || "-"}</p>
          </div>
          <span className={`statusPill ${statusClass(latestRequest?.status)}`}>
            {statusLabel(latestRequest?.status)}
          </span>
        </div>

        <div className="studentProgressRow">
          <span>Progression du dossier</span>
          <strong>Etape {progressStep(latestRequest?.status)}/9</strong>
        </div>
        <div className="studentProgressTrack">
          <span style={{ width: `${progressPercent(latestRequest?.status)}%` }} />
        </div>

        <div className="studentInfo twoColumns">
          <div>
            <strong>Milieu de stage</strong>
            <span>{latestRequest?.companyName || "Aucun milieu selectionne"}</span>
          </div>
          <div>
            <strong>Programme</strong>
            <span>{student?.programme || "-"}</span>
          </div>
        </div>

        <button className="secondaryButton studentActionButton" type="button" onClick={() => onNavigate("requests")}>
          Voir mon dossier complet
        </button>
      </section>

      <div className="studentDashboardGrid">
        <ContractsSummary requests={requests} onNavigate={onNavigate} />
        <NotificationsSummary latestRequest={latestRequest} />
      </div>

      <StatusLegend />

      {loading && <div className="studentMessage">Chargement du dossier...</div>}
    </>
  );
}

function RequestsView({ loading, student, requests, onCreated }) {
  return (
    <>
      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Profil etudiant</h2>
          {loading && <span className="statusPill">Chargement</span>}
        </div>

        <StudentProfile student={student} />
      </section>

      <StudentRequestForm onCreated={onCreated} />

      <RequestsTable requests={requests} />
    </>
  );
}

function ContractsView({ requests, onNavigate }) {
  return (
    <>
      <ContractsSummary requests={requests} onNavigate={onNavigate} expanded />
      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Documents de contrat</h2>
          <span className="statusPill">A venir</span>
        </div>
        <p className="notice">
          Le module complet des contrats sera branche apres la stabilisation des demandes de stage.
        </p>
      </section>
    </>
  );
}

function StudentProfile({ student }) {
  return (
    <div className="studentInfo">
      <div>
        <strong>Courriel</strong>
        <span>{student?.email || "-"}</span>
      </div>
      <div>
        <strong>Code etudiant</strong>
        <span>{student?.studentCode || "-"}</span>
      </div>
      <div>
        <strong>Code permanent</strong>
        <span>{student?.codePermanent || "-"}</span>
      </div>
      <div>
        <strong>Programme</strong>
        <span>{student?.programme || "-"}</span>
      </div>
      <div>
        <strong>Groupe</strong>
        <span>{student?.groupe || "-"}</span>
      </div>
    </div>
  );
}

function RequestsTable({ requests }) {
  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Mes demandes de stage</h2>
        <span className="statusPill">{requests.length} demande(s)</span>
      </div>

      <div className="studentTableWrap">
        <table>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Ville</th>
              <th>Dates</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.companyName}</td>
                <td>{request.companyCity || "-"}</td>
                <td>
                  {formatDate(request.startDate)} au {formatDate(request.endDate)}
                </td>
                <td>
                  <span className={`statusPill ${statusClass(request.status)}`}>
                    {statusLabel(request.status)}
                  </span>
                </td>
              </tr>
            ))}

            {!requests.length && (
              <tr>
                <td colSpan="4">Aucune demande pour le moment.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ContractsSummary({ requests, onNavigate, expanded = false }) {
  const contractRequests = requests.filter((request) =>
    ["APPROUVEE", "CONTRAT_EN_COURS", "DOSSIER_COMPLET"].includes(request.status)
  );

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Mes contrats</h2>
        <span className="statusPill">{contractRequests.length}</span>
      </div>

      {contractRequests.map((request) => (
        <div className="contractRow" key={request.id}>
          <span className={`contractDot ${statusClass(request.status)}`} />
          <div>
            <strong>{request.companyName}</strong>
            <span>{formatDate(request.startDate)} au {formatDate(request.endDate)}</span>
          </div>
          <span className={`statusPill ${statusClass(request.status)}`}>
            {statusLabel(request.status)}
          </span>
        </div>
      ))}

      {!contractRequests.length && (
        <p className="notice">Aucun contrat disponible pour le moment.</p>
      )}

      {!expanded && (
        <button className="linkButton panelLink" type="button" onClick={() => onNavigate("contracts")}>
          Voir mes contrats
        </button>
      )}
    </section>
  );
}

function NotificationsSummary({ latestRequest }) {
  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Notifications</h2>
        <span className="statusPill">1</span>
      </div>
      <div className="notificationItem">
        <span className="notificationDot" />
        <p>
          {latestRequest
            ? `Votre demande chez ${latestRequest.companyName} est ${statusLabel(latestRequest.status).toLowerCase()}.`
            : "Aucune demande active pour le moment."}
        </p>
      </div>
    </section>
  );
}

function StatusLegend() {
  return (
    <section className="studentPanel legendPanel">
      <h2>Legende des statuts</h2>
      <div className="legendList">
        <span><i className="legendDot statusYellow" /> Demande non creee</span>
        <span><i className="legendDot statusOrange" /> En attente de signature</span>
        <span><i className="legendDot statusRed" /> Refus ou document incomplet</span>
        <span><i className="legendDot statusGreen" /> Dossier complet et approuve</span>
      </div>
    </section>
  );
}

function statusLabel(status) {
  const labels = {
    SOUMISE: "Demande soumise",
    APPROUVEE: "Dossier approuve",
    REFUSEE: "Refusee",
    ANNULEE: "Annulee",
    CONTRAT_EN_COURS: "Contrat en cours",
    DOSSIER_COMPLET: "Dossier complet"
  };

  return labels[status] || "Demande non creee";
}

function statusClass(status) {
  if (status === "APPROUVEE" || status === "DOSSIER_COMPLET") {
    return "statusGreen";
  }
  if (status === "REFUSEE") {
    return "statusRed";
  }
  if (status === "CONTRAT_EN_COURS") {
    return "statusOrange";
  }
  return "statusYellow";
}

function progressStep(status) {
  const steps = {
    SOUMISE: 3,
    APPROUVEE: 6,
    CONTRAT_EN_COURS: 7,
    DOSSIER_COMPLET: 9
  };

  return steps[status] || 1;
}

function progressPercent(status) {
  return Math.round((progressStep(status) / 9) * 100);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("fr-CA");
}
