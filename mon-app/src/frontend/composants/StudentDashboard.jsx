import { useEffect, useMemo, useState } from "react";
import StudentRequestForm from "./StudentRequestForm.jsx";
import StudentRequestEditForm from "./StudentRequestEditForm.jsx";

export default function StudentDashboard({
  view,
  onNavigate
}) {
  const [student, setStudent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const latestRequest = useMemo(
    () => requests[0] || null,
    [requests]
  );

  async function loadDashboard() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError(
        "Session expirée. Veuillez vous reconnecter."
      );
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/students/dashboard",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de charger le tableau de bord."
        );
        return;
      }

      setStudent(data.student);
      setRequests(data.requests || []);
      setError("");
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Erreur de connexion au serveur."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <>
      {error && (
        <div className="studentError">
          {error}
        </div>
      )}

      {view === "requests" && (
        <RequestsView
          loading={loading}
          student={student}
          requests={requests}
          onCreated={loadDashboard}
        />
      )}

      {view === "contracts" && (
        <ContractsView
          requests={requests}
          onNavigate={onNavigate}
        />
      )}

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

function OverviewView({
  loading,
  student,
  latestRequest,
  requests,
  onNavigate
}) {
  return (
    <>
      <section className="studentHeroCard">
        <div className="studentHeroHeader">
          <div>
            <h2>Mon dossier de stage</h2>

            <p>
              {student?.studentCode || "-"} -{" "}
              {student?.programme || "-"}
            </p>
          </div>

          <span
            className={`statusPill ${statusClass(
              latestRequest?.status
            )}`}
          >
            {statusLabel(latestRequest?.status)}
          </span>
        </div>

        <div className="studentProgressRow">
          <span>Progression du dossier</span>

          <strong>
            Étape{" "}
            {progressStep(latestRequest?.status)}
            /9
          </strong>
        </div>

        <div className="studentProgressTrack">
          <span
            style={{
              width: `${progressPercent(
                latestRequest?.status
              )}%`
            }}
          />
        </div>

        <div className="studentInfo twoColumns">
          <div>
            <strong>Milieu de stage</strong>

            <span>
              {latestRequest?.companyName ||
                "Aucun milieu sélectionné"}
            </span>
          </div>

          <div>
            <strong>Programme</strong>

            <span>
              {student?.programme || "-"}
            </span>
          </div>

          <div>
            <strong>Période</strong>

            <span>
              {latestRequest
                ? `${formatDate(
                    latestRequest.startDate
                  )} au ${formatDate(
                    latestRequest.endDate
                  )}`
                : "-"}
            </span>
          </div>

          <div>
            <strong>Horaire</strong>

            <span>
              {latestRequest?.workSchedule || "-"}
            </span>
          </div>
        </div>

        <button
          className="secondaryButton studentActionButton"
          type="button"
          onClick={() => onNavigate("requests")}
        >
          Voir mon dossier complet
        </button>
      </section>

      <div className="studentDashboardGrid">
        <ContractsSummary
          requests={requests}
          onNavigate={onNavigate}
        />

        <NotificationsSummary
          latestRequest={latestRequest}
        />
      </div>

      <StatusLegend />

      {loading && (
        <div className="studentMessage">
          Chargement du dossier...
        </div>
      )}
    </>
  );
}

function RequestsView({
  loading,
  student,
  requests,
  onCreated
}) {
  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [editingRequest, setEditingRequest] =
    useState(null);

  async function handleUpdated() {
    await onCreated();
    setEditingRequest(null);
    setSelectedRequest(null);
  }

  return (
    <>
      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Profil étudiant</h2>

          {loading && (
            <span className="statusPill">
              Chargement
            </span>
          )}
        </div>

        <StudentProfile student={student} />
      </section>

      {editingRequest ? (
        <StudentRequestEditForm
          request={editingRequest}
          onUpdated={handleUpdated}
          onCancel={() =>
            setEditingRequest(null)
          }
        />
      ) : (
        <StudentRequestForm
          student={student}
          onCreated={onCreated}
        />
      )}

      <RequestsTable
        requests={requests}
        selectedRequest={selectedRequest}
        onSelect={setSelectedRequest}
        onEdit={setEditingRequest}
      />

      {selectedRequest && (
        <RequestDetails
          request={selectedRequest}
          onClose={() =>
            setSelectedRequest(null)
          }
        />
      )}
    </>
  );
}

function ContractsView({
  requests,
  onNavigate
}) {
  return (
    <>
      <ContractsSummary
        requests={requests}
        onNavigate={onNavigate}
        expanded
      />

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Documents de contrat</h2>

          <span className="statusPill">
            À venir
          </span>
        </div>

        <p className="notice">
          Le module des contrats sera disponible
          après l’approbation de la demande de
          stage.
        </p>
      </section>
    </>
  );
}

function StudentProfile({ student }) {
  return (
    <div className="studentInfo">
      <div>
        <strong>Nom complet</strong>

        <span>
          {student
            ? `${student.firstName || ""} ${
                student.lastName || ""
              }`.trim()
            : "-"}
        </span>
      </div>

      <div>
        <strong>Courriel</strong>

        <span>{student?.email || "-"}</span>
      </div>

      <div>
        <strong>Code étudiant</strong>

        <span>
          {student?.studentCode || "-"}
        </span>
      </div>

      <div>
        <strong>Code permanent</strong>

        <span>
          {student?.codePermanent || "-"}
        </span>
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

function RequestsTable({
  requests,
  selectedRequest,
  onSelect,
  onEdit
}) {
  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Mes demandes de stage</h2>

        <span className="statusPill">
          {requests.length} demande(s)
        </span>
      </div>

      <div className="studentTableWrap">
        <table>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Ville</th>
              <th>Dates</th>
              <th>Horaire</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {requests.map((request) => {
              const canEdit = [
                "SOUMISE",
                "REFUSEE"
              ].includes(request.status);

              return (
                <tr key={request.id}>
                  <td>
                    {request.companyName || "-"}
                  </td>

                  <td>
                    {request.companyCity || "-"}
                  </td>

                  <td>
                    {formatDate(
                      request.startDate
                    )}{" "}
                    au{" "}
                    {formatDate(
                      request.endDate
                    )}
                  </td>

                  <td>
                    {scheduleTypeLabel(
                      request.scheduleType
                    )}
                  </td>

                  <td>
                    <span
                      className={`statusPill ${statusClass(
                        request.status
                      )}`}
                    >
                      {statusLabel(
                        request.status
                      )}
                    </span>
                  </td>

                  <td>
                    <div className="requestActions">
                      <button
                        className="secondaryButton"
                        type="button"
                        onClick={() =>
                          onSelect(request)
                        }
                      >
                        {selectedRequest?.id ===
                        request.id
                          ? "Sélectionnée"
                          : "Voir"}
                      </button>

                      {canEdit && (
                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() =>
                            onEdit(request)
                          }
                        >
                          Modifier
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!requests.length && (
              <tr>
                <td colSpan="6">
                  Aucune demande pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RequestDetails({
  request,
  onClose
}) {
  return (
    <section className="studentPanel requestDetailsPanel">
      <div className="panelHeader">
        <div>
          <h2>Détail de la demande</h2>

          <p>
            Demande #{request.id}
          </p>
        </div>

        <div className="requestDetailsHeaderActions">
          <span
            className={`statusPill ${statusClass(
              request.status
            )}`}
          >
            {statusLabel(request.status)}
          </span>

          <button
            className="secondaryButton"
            type="button"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>
      </div>

      {request.refusalReason && (
        <div className="studentError">
          <strong>Motif du refus :</strong>{" "}
          {request.refusalReason}
        </div>
      )}

      <DetailsSection title="1. Stage">
        <DetailItem
          label="Résumé des tâches"
          value={request.taskSummary}
          wide
        />

        <DetailItem
          label="Date de début"
          value={formatDate(request.startDate)}
        />

        <DetailItem
          label="Date de fin"
          value={formatDate(request.endDate)}
        />

        <DetailItem
          label="Horaire de travail"
          value={request.workSchedule}
        />

        <DetailItem
          label="Heures par semaine"
          value={
            request.hoursPerWeek
              ? `${request.hoursPerWeek} h`
              : "-"
          }
        />

        <DetailItem
          label="Nombre de semaines"
          value={request.numberOfWeeks}
        />

        <DetailItem
          label="Langue de travail"
          value={request.workLanguage}
        />

        <DetailItem
          label="Type d’horaire"
          value={scheduleTypeLabel(
            request.scheduleType
          )}
        />
      </DetailsSection>

      <DetailsSection title="2. Entreprise">
        <DetailItem
          label="Nom"
          value={request.companyName}
        />

        <DetailItem
          label="NEQ"
          value={request.companyNeq}
        />

        <DetailItem
          label="Adresse"
          value={request.companyAddress}
          wide
        />

        <DetailItem
          label="Ville"
          value={request.companyCity}
        />

        <DetailItem
          label="Code postal"
          value={request.companyPostalCode}
        />

        <DetailItem
          label="Téléphone"
          value={formatPhoneWithExtension(
            request.companyPhone,
            request.companyPhoneExtension
          )}
        />

        <DetailItem
          label="Courriel"
          value={request.companyEmail}
        />

        <DetailItem
          label="Site Internet"
          value={request.companyWebsite}
        />

        <DetailItem
          label="Type d’organisation"
          value={organizationTypeLabel(
            request.organizationType
          )}
        />

        <DetailItem
          label="Secteur d’activité"
          value={request.businessSector}
        />
      </DetailsSection>

      <DetailsSection title="3. Responsable des ressources humaines">
        <DetailItem
          label="Nom"
          value={request.hrName}
        />

        <DetailItem
          label="Courriel"
          value={request.hrEmail}
        />

        <DetailItem
          label="Téléphone"
          value={formatPhoneWithExtension(
            request.hrPhone,
            request.hrExtension
          )}
        />
      </DetailsSection>

      <DetailsSection title="4. Superviseur en entreprise">
        <DetailItem
          label="Nom"
          value={request.supervisorName}
        />

        <DetailItem
          label="Titre professionnel"
          value={request.supervisorTitle}
        />

        <DetailItem
          label="Courriel"
          value={request.supervisorEmail}
        />

        <DetailItem
          label="Téléphone"
          value={request.supervisorPhone}
        />
      </DetailsSection>

      <DetailsSection title="5. Rémunération">
        <DetailItem
          label="Stage rémunéré"
          value={request.isPaid ? "Oui" : "Non"}
        />

        <DetailItem
          label="Salaire horaire"
          value={
            request.isPaid &&
            request.hourlySalary !== null &&
            request.hourlySalary !== undefined
              ? formatMoney(
                  request.hourlySalary
                )
              : "-"
          }
        />

        <DetailItem
          label="Autre compensation"
          value={request.otherCompensation}
          wide
        />
      </DetailsSection>
    </section>
  );
}

function DetailsSection({
  title,
  children
}) {
  return (
    <div className="requestDetailsSection">
      <h3>{title}</h3>

      <div className="requestDetailsGrid">
        {children}
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide = false
}) {
  return (
    <div
      className={`requestDetailItem ${
        wide ? "requestDetailWide" : ""
      }`}
    >
      <strong>{label}</strong>

      <span>{displayValue(value)}</span>
    </div>
  );
}

function ContractsSummary({
  requests,
  onNavigate,
  expanded = false
}) {
  const contractRequests = requests.filter(
    (request) =>
      [
        "APPROUVEE",
        "CONTRAT_EN_COURS",
        "DOSSIER_COMPLET"
      ].includes(request.status)
  );

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Mes contrats</h2>

        <span className="statusPill">
          {contractRequests.length}
        </span>
      </div>

      {contractRequests.map((request) => (
        <div
          className="contractRow"
          key={request.id}
        >
          <span
            className={`contractDot ${statusClass(
              request.status
            )}`}
          />

          <div>
            <strong>
              {request.companyName}
            </strong>

            <span>
              {formatDate(
                request.startDate
              )}{" "}
              au{" "}
              {formatDate(request.endDate)}
            </span>
          </div>

          <span
            className={`statusPill ${statusClass(
              request.status
            )}`}
          >
            {statusLabel(request.status)}
          </span>
        </div>
      ))}

      {!contractRequests.length && (
        <p className="notice">
          Aucun contrat disponible pour le
          moment.
        </p>
      )}

      {!expanded && (
        <button
          className="linkButton panelLink"
          type="button"
          onClick={() =>
            onNavigate("contracts")
          }
        >
          Voir mes contrats
        </button>
      )}
    </section>
  );
}

function NotificationsSummary({
  latestRequest
}) {
  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Notifications</h2>

        <span className="statusPill">
          {latestRequest ? 1 : 0}
        </span>
      </div>

      <div className="notificationItem">
        <span className="notificationDot" />

        <p>
          {latestRequest
            ? `Votre demande chez ${
                latestRequest.companyName
              } est ${statusLabel(
                latestRequest.status
              ).toLowerCase()}.`
            : "Aucune demande active pour le moment."}
        </p>
      </div>
    </section>
  );
}

function StatusLegend() {
  return (
    <section className="studentPanel legendPanel">
      <h2>Légende des statuts</h2>

      <div className="legendList">
        <span>
          <i className="legendDot statusYellow" />
          Demande non créée ou soumise
        </span>

        <span>
          <i className="legendDot statusOrange" />
          Contrat ou signature en attente
        </span>

        <span>
          <i className="legendDot statusRed" />
          Refus ou document incomplet
        </span>

        <span>
          <i className="legendDot statusGreen" />
          Dossier approuvé ou complet
        </span>
      </div>
    </section>
  );
}

function statusLabel(status) {
  const labels = {
    SOUMISE: "Demande soumise",
    APPROUVEE: "Dossier approuvé",
    REFUSEE: "Demande refusée",
    ANNULEE: "Demande annulée",
    CONTRAT_EN_COURS: "Contrat en cours",
    DOSSIER_COMPLET: "Dossier complet"
  };

  return labels[status] || "Demande non créée";
}

function statusClass(status) {
  if (
    status === "APPROUVEE" ||
    status === "DOSSIER_COMPLET"
  ) {
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

function scheduleTypeLabel(value) {
  const labels = {
    TEMPS_PLEIN: "Temps plein",
    TEMPS_PARTIEL: "Temps partiel"
  };

  return labels[value] || "-";
}

function organizationTypeLabel(value) {
  const labels = {
    PUBLIC: "Organisme public",
    PRIVE: "Entreprise privée"
  };

  return labels[value] || "-";
}

function progressStep(status) {
  const steps = {
    SOUMISE: 3,
    REFUSEE: 3,
    APPROUVEE: 6,
    CONTRAT_EN_COURS: 7,
    DOSSIER_COMPLET: 9
  };

  return steps[status] || 1;
}

function progressPercent(status) {
  return Math.round(
    (progressStep(status) / 9) * 100
  );
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const dateValue = String(value).slice(0, 10);
  const date = new Date(
    `${dateValue}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("fr-CA");
}

function formatMoney(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD"
  }).format(numberValue);
}

function formatPhoneWithExtension(
  phone,
  extension
) {
  if (!phone) {
    return "-";
  }

  if (!extension) {
    return phone;
  }

  return `${phone}, poste ${extension}`;
}

function displayValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return String(value);
}
