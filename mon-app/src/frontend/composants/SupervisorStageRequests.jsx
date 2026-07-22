import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import SupervisorRequestDetails from "./SupervisorRequestDetails.jsx";
import SupervisorCorrectionModal from "./SupervisorCorrectionModal.jsx";
import SupervisorRefusalModal from "./SupervisorRefusalModal.jsx";

export default function SupervisorStageRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [requestToRefuse, setRequestToRefuse] =
    useState(null);
  const [requestToCorrect, setRequestToCorrect] =
    useState(null);
  const [correctionStatus, setCorrectionStatus] =
    useState("A_REVISER");

  const [filter, setFilter] = useState("A_TRAITER");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredRequests = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();
    const searchedRequests = normalizedSearch
      ? requests.filter((request) =>
          [
            request.studentFullName,
            request.studentCode,
            request.companyName
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        )
      : requests;

    if (filter === "TOUTES") {
      return searchedRequests;
    }

    if (filter === "A_TRAITER") {
      return searchedRequests.filter(
        (request) => request.status === "SOUMISE"
      );
    }

    if (filter === "RESOUMISES") {
      return searchedRequests.filter(isResubmitted);
    }

    if (filter === "CORRECTIONS") {
      return searchedRequests.filter((request) =>
        [
          "A_REVISER",
          "DOCUMENTS_MANQUANTS"
        ].includes(request.status)
      );
    }

    return searchedRequests.filter(
      (request) => request.status === filter
    );
  }, [requests, filter, search]);

  const stats = useMemo(
    () => ({
      toReview: requests.filter(
        (request) => request.status === "SOUMISE"
      ).length,
      resubmitted: requests.filter(isResubmitted).length,
      corrections: requests.filter((request) =>
        [
          "A_REVISER",
          "DOCUMENTS_MANQUANTS"
        ].includes(request.status)
      ).length,
      approved: requests.filter(
        (request) => request.status === "APPROUVEE"
      ).length,
      refused: requests.filter(
        (request) => request.status === "REFUSEE"
      ).length
    }),
    [requests]
  );

  const loadRequests = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setError(
        "Session expirée. Veuillez vous reconnecter."
      );

      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/supervisor/stages/requests",
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
            "Impossible de charger les demandes."
        );

        return;
      }

      setRequests(data.requests || []);

      if (selectedRequest) {
        const updatedSelectedRequest =
          (data.requests || []).find(
            (request) =>
              request.id === selectedRequest.id
          );

        setSelectedRequest(
          updatedSelectedRequest || null
        );
      }
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Erreur de connexion au serveur."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedRequest]);

  async function approveRequest(request) {
    const confirmed = window.confirm(
      `Voulez-vous approuver la demande de ${request.studentFullName} ?`
    );

    if (!confirmed) {
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `/api/supervisor/stages/requests/${request.id}/approve`,
        {
          method: "PUT",
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
            "Impossible d’approuver la demande."
        );

        return;
      }

      setSuccess(
        data.message ||
          "La demande a été approuvée."
      );

      await loadRequests();
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Erreur de connexion au serveur."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function refuseRequest(
    request,
    refusalReason
  ) {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `/api/supervisor/stages/requests/${request.id}/refuse`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            refusalReason
          })
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de refuser la demande."
        );

        return false;
      }

      setSuccess(
        data.message ||
          "La demande a été refusée."
      );

      setRequestToRefuse(null);

      await loadRequests();

      return true;
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Erreur de connexion au serveur."
      );

      return false;
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  async function requestCorrections(
    request,
    payload
  ) {
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `/api/supervisor/stages/requests/${request.id}/corrections`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de demander les corrections."
        );

        return false;
      }

      setSuccess(
        data.message ||
          "La demande de correction a ete envoyee."
      );
      setRequestToCorrect(null);

      await loadRequests();

      return true;
    } catch (requestError) {
      console.error(requestError);
      setError(
        "Erreur de connexion au serveur."
      );
      return false;
    } finally {
      setActionLoading(false);
    }
  }

  async function openDetails(request) {
    const token = localStorage.getItem("token");

    setSelectedRequest(request);
    setError("");
    setSuccess("");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `/api/supervisor/stages/requests/${request.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (response.ok && data.request) {
        setSelectedRequest(data.request);
      }
    } catch (requestError) {
      console.error(requestError);
    }
  }

  function openRefusalModal(request) {
    setRequestToRefuse(request);
    setError("");
    setSuccess("");
  }

  function openCorrectionModal(request, status) {
    setRequestToCorrect(request);
    setCorrectionStatus(status);
    setError("");
    setSuccess("");
  }

  return (
    <section className="studentPanel supervisorStagePanel">
      <div className="panelHeader">
        <div>
          <h2>Demandes de stage à valider</h2>

          <p>
            Consultez, approuvez ou refusez les
            demandes des étudiants qui vous sont
            assignés.
          </p>
        </div>

        <span className="statusPill">
          {requests.length} demande(s)
        </span>
      </div>

      <div className="stageInfo">
        <div className="statCard">
          <strong>A traiter</strong>
          <span>{stats.toReview}</span>
        </div>

        <div className="statCard">
          <strong>Resoumises</strong>
          <span>{stats.resubmitted}</span>
        </div>

        <div className="statCard">
          <strong>Corrections</strong>
          <span>{stats.corrections}</span>
        </div>

        <div className="statCard">
          <strong>Approuvees</strong>
          <span>{stats.approved}</span>
        </div>

        <div className="statCard">
          <strong>Refusees</strong>
          <span>{stats.refused}</span>
        </div>
      </div>

      <div className="supervisorStageFilters">
        <label className="tableFilter">
          Filtrer les demandes
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
          >
            <option value="A_TRAITER">A traiter</option>
            <option value="RESOUMISES">Resoumises</option>
            <option value="SOUMISE">En analyse</option>
            <option value="A_REVISER">A reviser</option>
            <option value="DOCUMENTS_MANQUANTS">
              Documents manquants
            </option>
            <option value="APPROUVEE">Approuvees</option>
            <option value="REFUSEE">Refus definitifs</option>
            <option value="TOUTES">Toutes</option>
          </select>
        </label>

        <label className="tableFilter">
          Rechercher
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Nom, code ou entreprise"
          />
        </label>

        <button
          className="secondaryButton"
          type="button"
          onClick={loadRequests}
          disabled={loading}
        >
          Actualiser
        </button>
      </div>

      <p className="tableResultCount">
        {filteredRequests.length} resultat(s)
      </p>

      {error && (
        <div className="studentError">
          {error}
        </div>
      )}

      {success && (
        <div className="studentSuccess">
          {success}
        </div>
      )}

      {loading ? (
        <div className="studentMessage">
          Chargement des demandes...
        </div>
      ) : (
        <RequestsTable
          requests={filteredRequests}
          selectedRequest={selectedRequest}
          actionLoading={actionLoading}
          onView={openDetails}
          onApprove={approveRequest}
          onRequestCorrections={openCorrectionModal}
          onRefuse={openRefusalModal}
        />
      )}

      {selectedRequest && (
        <SupervisorRequestDetails
          request={selectedRequest}
          actionLoading={actionLoading}
          onApprove={approveRequest}
          onRequestCorrections={openCorrectionModal}
          onRefuse={openRefusalModal}
          onClose={() =>
            setSelectedRequest(null)
          }
        />
      )}

      {requestToRefuse && (
        <SupervisorRefusalModal
          request={requestToRefuse}
          loading={actionLoading}
          onConfirm={refuseRequest}
          onCancel={() =>
            setRequestToRefuse(null)
          }
        />
      )}

      {requestToCorrect && (
        <SupervisorCorrectionModal
          request={requestToCorrect}
          status={correctionStatus}
          loading={actionLoading}
          onConfirm={requestCorrections}
          onCancel={() =>
            setRequestToCorrect(null)
          }
        />
      )}
    </section>
  );
}

function RequestsTable({
  requests,
  selectedRequest,
  actionLoading,
  onView,
  onApprove,
  onRequestCorrections,
  onRefuse
}) {
  return (
    <div className="studentTableWrap">
      <table>
        <thead>
          <tr>
            <th>Etudiant</th>
            <th>Entreprise</th>
            <th>Periode</th>
            <th>Statut</th>
            <th>Prochaine action</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => {
            const canDecide =
              request.status === "SOUMISE";
            const nextAction =
              nextActionLabel(request);

            return (
              <tr key={request.id}>
                <td>
                  <span className="tablePrimaryText">
                    {request.studentFullName ||
                      "-"}
                  </span>

                  <div className="tableSecondaryText">
                    {request.studentCode || "-"}
                  </div>
                </td>

                <td>
                  <span className="tablePrimaryText">
                    {request.companyName || "-"}
                  </span>

                  <div className="tableSecondaryText">
                    {request.companyCity || "-"}
                  </div>
                </td>

                <td>
                  {formatDate(
                    request.startDate
                  )}{" "}
                  au{" "}
                  {formatDate(
                    request.endDate
                  )}

                  <span className="tableSubtext">
                    Soumise :{" "}
                    {formatDateTime(
                      request.createdAt
                    )}
                  </span>

                  <span className="tableSubtext">
                    Mise a jour :{" "}
                    {formatDateTime(
                      request.updatedAt ||
                        request.resubmittedAt
                    )}
                  </span>

                  {isResubmitted(request) && (
                    <span className="statusPill statusBlue">
                      Resoumise
                    </span>
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
                  <div className="nextActionText">
                    <strong>{nextAction.title}</strong>
                    <span>{nextAction.detail}</span>
                  </div>
                </td>

                <td>
                  <div className="requestActions">
                    <button
                      className="secondaryButton"
                      type="button"
                      onClick={() =>
                        onView(request)
                      }
                    >
                      {selectedRequest?.id ===
                      request.id
                        ? "Ouverte"
                        : "Voir"}
                    </button>

                    {canDecide && (
                      <>
                        <button
                          className="primaryButton"
                          type="button"
                          onClick={() =>
                            onApprove(request)
                          }
                          disabled={actionLoading}
                        >
                          Approuver
                        </button>

                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() =>
                            onRequestCorrections(
                              request,
                              "A_REVISER"
                            )
                          }
                          disabled={actionLoading}
                        >
                          Demander corrections
                        </button>

                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() =>
                            onRequestCorrections(
                              request,
                              "DOCUMENTS_MANQUANTS"
                            )
                          }
                          disabled={actionLoading}
                        >
                          Documents manquants
                        </button>

                        <button
                          className="dangerButton"
                          type="button"
                          onClick={() =>
                            onRefuse(request)
                          }
                          disabled={actionLoading}
                        >
                          Refuser definitivement
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}

          {!requests.length && (
            <tr>
              <td colSpan="6">
                <div className="emptyState">
                  <strong>Aucune demande trouvee</strong>
                  <span>
                    Aucune demande ne correspond au filtre.
                  </span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function isResubmitted(request) {
  if (
    request.status === "SOUMISE" &&
    request.resubmittedAt
  ) {
    return true;
  }

  if (
    request.status !== "SOUMISE" ||
    !request.createdAt ||
    !request.updatedAt
  ) {
    return false;
  }

  const createdAt = new Date(request.createdAt);
  const updatedAt = new Date(request.updatedAt);

  if (
    Number.isNaN(createdAt.getTime()) ||
    Number.isNaN(updatedAt.getTime())
  ) {
    return false;
  }

  return updatedAt.getTime() - createdAt.getTime() > 60000;
}

function nextActionLabel(request) {
  if (request.status === "SOUMISE") {
    return isResubmitted(request)
      ? {
          title: "Revoir les corrections",
          detail: "La demande a ete mise a jour."
        }
      : {
          title: "Decision requise",
          detail: "Ouvrir le detail puis approuver ou refuser."
        };
  }

  if (request.status === "APPROUVEE") {
    return {
      title: "Contrat genere",
      detail: "L'etudiant doit completer le contrat."
    };
  }

  if (request.status === "REFUSEE") {
    return {
      title: "Dossier ferme",
      detail: "Refus definitif."
    };
  }

  if (request.status === "A_REVISER") {
    return {
      title: "Attente correction",
      detail:
        "L'etudiant doit corriger la demande."
    };
  }

  if (request.status === "DOCUMENTS_MANQUANTS") {
    return {
      title: "Documents attendus",
      detail:
        "L'etudiant doit deposer les pieces demandees."
    };
  }

  return {
    title: "Suivi",
    detail: "Aucune action immediate."
  };
}

function statusLabel(status) {
  const labels = {
    BROUILLON: "Brouillon",
    SOUMISE: "À traiter",
    A_REVISER: "A reviser",
    DOCUMENTS_MANQUANTS: "Documents manquants",
    APPROUVEE: "Approuvée",
    REFUSEE: "Refusée",
    ANNULEE: "Annulée"
  };

  return labels[status] || status || "-";
}

function statusClass(status) {
  if (status === "APPROUVEE") {
    return "statusGreen";
  }

  if (status === "REFUSEE") {
    return "statusRed";
  }

  if (
    status === "A_REVISER" ||
    status === "DOCUMENTS_MANQUANTS"
  ) {
    return "statusYellow";
  }

  if (status === "SOUMISE") {
    return "statusOrange";
  }

  return "statusYellow";
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

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("fr-CA", {
    dateStyle: "short",
    timeStyle: "short"
  });
}
