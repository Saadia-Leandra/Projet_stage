import { useEffect, useMemo, useState } from "react";

import SupervisorRequestDetails from "./SupervisorRequestDetails.jsx";
import SupervisorRefusalModal from "./SupervisorRefusalModal.jsx";

export default function SupervisorStageRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [requestToRefuse, setRequestToRefuse] =
    useState(null);

  const [filter, setFilter] = useState("TOUTES");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredRequests = useMemo(() => {
    if (filter === "TOUTES") {
      return requests;
    }

    return requests.filter(
      (request) => request.status === filter
    );
  }, [requests, filter]);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
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
  }

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

  function openDetails(request) {
    setSelectedRequest(request);
    setError("");
    setSuccess("");
  }

  function openRefusalModal(request) {
    setRequestToRefuse(request);
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

      <div className="supervisorStageFilters">
        <button
          className={filterButtonClass(
            filter,
            "TOUTES"
          )}
          type="button"
          onClick={() => setFilter("TOUTES")}
        >
          Toutes
        </button>

        <button
          className={filterButtonClass(
            filter,
            "SOUMISE"
          )}
          type="button"
          onClick={() => setFilter("SOUMISE")}
        >
          À traiter
        </button>

        <button
          className={filterButtonClass(
            filter,
            "APPROUVEE"
          )}
          type="button"
          onClick={() =>
            setFilter("APPROUVEE")
          }
        >
          Approuvées
        </button>

        <button
          className={filterButtonClass(
            filter,
            "REFUSEE"
          )}
          type="button"
          onClick={() => setFilter("REFUSEE")}
        >
          Refusées
        </button>

        <button
          className="secondaryButton"
          type="button"
          onClick={loadRequests}
          disabled={loading}
        >
          Actualiser
        </button>
      </div>

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
          onRefuse={openRefusalModal}
        />
      )}

      {selectedRequest && (
        <SupervisorRequestDetails
          request={selectedRequest}
          actionLoading={actionLoading}
          onApprove={approveRequest}
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
    </section>
  );
}

function RequestsTable({
  requests,
  selectedRequest,
  actionLoading,
  onView,
  onApprove,
  onRefuse
}) {
  return (
    <div className="studentTableWrap">
      <table>
        <thead>
          <tr>
            <th>Étudiant</th>
            <th>Entreprise</th>
            <th>Période</th>
            <th>Soumise le</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {requests.map((request) => {
            const canDecide =
              request.status === "SOUMISE";

            return (
              <tr key={request.id}>
                <td>
                  <strong>
                    {request.studentFullName ||
                      "-"}
                  </strong>

                  <div className="tableSecondaryText">
                    {request.studentCode || "-"}
                  </div>
                </td>

                <td>
                  <strong>
                    {request.companyName || "-"}
                  </strong>

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
                </td>

                <td>
                  {formatDateTime(
                    request.createdAt
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
                          className="dangerButton"
                          type="button"
                          onClick={() =>
                            onRefuse(request)
                          }
                          disabled={actionLoading}
                        >
                          Refuser
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
                Aucune demande ne correspond à ce
                filtre.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function filterButtonClass(
  currentFilter,
  buttonFilter
) {
  if (currentFilter === buttonFilter) {
    return "primaryButton";
  }

  return "secondaryButton";
}

function statusLabel(status) {
  const labels = {
    BROUILLON: "Brouillon",
    SOUMISE: "À traiter",
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