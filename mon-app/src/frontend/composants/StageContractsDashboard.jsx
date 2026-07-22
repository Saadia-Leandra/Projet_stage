import { useEffect, useMemo, useState } from "react";

export default function StageContractsDashboard({ user }) {
  const [requests, setRequests] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [requestFilter, setRequestFilter] =
    useState("TOUTES");
  const [contractFilter, setContractFilter] =
    useState("TOUS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const headers = {
        Authorization: `Bearer ${token}`
      };

      const [
        requestsResponse,
        contractsResponse,
        notificationsResponse
      ] =
        await Promise.all([
          fetch("/api/stage-management/requests", {
            headers
          }),
          fetch("/api/stage-management/contracts", {
            headers
          }),
          fetch("/api/notifications", { headers })
        ]);

      const requestsData = await requestsResponse
        .json()
        .catch(() => ({}));

      const contractsData = await contractsResponse
        .json()
        .catch(() => ({}));

      if (!requestsResponse.ok) {
        setError(
          requestsData.error ||
            "Impossible de charger les demandes."
        );
        return;
      }

      if (!contractsResponse.ok) {
        setError(
          contractsData.error ||
            "Impossible de charger les contrats."
        );
        return;
      }

      const notificationsData =
        await notificationsResponse
          .json()
          .catch(() => ({}));

      setRequests(requestsData.requests || []);
      setContracts(contractsData.contracts || []);
      setNotifications(
        notificationsResponse.ok
          ? notificationsData.notifications || []
          : []
      );
      setError("");
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedId && contracts[0]) {
      setSelectedId(contracts[0].id);
    }
  }, [contracts, selectedId]);

  const selectedContract = useMemo(
    () =>
      contracts.find(
        (contract) => contract.id === selectedId
      ) || contracts[0],
    [contracts, selectedId]
  );

  const stats = useMemo(
    () => ({
      submittedRequests: requests.filter(
        (request) => request.status === "SOUMISE"
      ).length,
      approvedRequests: requests.filter(
        (request) => request.status === "APPROUVEE"
      ).length,
      contractsToComplete: contracts.filter(
        (contract) =>
          contract.status === "A_COMPLETER_ETUDIANT"
      ).length,
      contractsInSignature: contracts.filter(
        (contract) => isSignatureStatus(contract.status)
      ).length,
      completedContracts: contracts.filter(
        (contract) =>
          contract.status === "DOSSIER_COMPLET"
      ).length
    }),
    [requests, contracts]
  );

  const filteredRequests = useMemo(() => {
    if (requestFilter === "TOUTES") {
      return requests;
    }

    return requests.filter(
      (request) => request.status === requestFilter
    );
  }, [requests, requestFilter]);

  const filteredContracts = useMemo(() => {
    if (contractFilter === "TOUS") {
      return contracts;
    }

    if (contractFilter === "SIGNATURE") {
      return contracts.filter((contract) =>
        isSignatureStatus(contract.status)
      );
    }

    return contracts.filter(
      (contract) => contract.status === contractFilter
    );
  }, [contracts, contractFilter]);

  return (
    <>
      {error && (
        <div className="studentError">{error}</div>
      )}

      <section className="studentPanel">
        <div className="panelHeader">
          <div>
            <h2>Vue d'ensemble</h2>
            <p>{roleText(user.role)}</p>
          </div>

          <span className="statusPill">
            {loading ? "Chargement" : "A jour"}
          </span>
        </div>

        <div className="stageInfo">
          <div className="statCard">
            <strong>Demandes a traiter</strong>
            <span>{stats.submittedRequests}</span>
          </div>

          <div className="statCard">
            <strong>Demandes approuvees</strong>
            <span>{stats.approvedRequests}</span>
          </div>

          <div className="statCard">
            <strong>Contrats a completer</strong>
            <span>{stats.contractsToComplete}</span>
          </div>

          <div className="statCard">
            <strong>Contrats en signature</strong>
            <span>{stats.contractsInSignature}</span>
          </div>

          <div className="statCard">
            <strong>Dossiers complets</strong>
            <span>{stats.completedContracts}</span>
          </div>
        </div>
      </section>

      <section className="studentPanel">
        <div className="panelHeader">
          <div>
            <h2>Demandes de stage</h2>
            <p>Lecture des demandes selon votre role.</p>
          </div>

          <span className="statusPill">
            {loading
              ? "Chargement"
              : `${requests.length} demande(s)`}
          </span>
        </div>

        <div className="tableToolbar">
          <label className="tableFilter">
            Filtrer les demandes
            <select
              value={requestFilter}
              onChange={(event) =>
                setRequestFilter(event.target.value)
              }
            >
              <option value="TOUTES">Toutes</option>
              <option value="SOUMISE">A traiter</option>
              <option value="A_REVISER">A reviser</option>
              <option value="DOCUMENTS_MANQUANTS">
                Documents manquants
              </option>
              <option value="APPROUVEE">Approuvees</option>
              <option value="REFUSEE">Refus definitifs</option>
            </select>
          </label>
        </div>

        <div className="studentTableWrap">
          <table>
            <thead>
              <tr>
                <th>Etudiant</th>
                <th>Entreprise</th>
                <th>Periode</th>
                <th>Statut</th>
                <th>Prochaine action</th>
              </tr>
            </thead>

            <tbody>
              {filteredRequests.map((request) => {
                const nextAction =
                  requestNextAction(request);

                return (
                  <tr key={request.id}>
                    <td>
                      <span className="tablePrimaryText">
                        {request.studentName || "-"}
                      </span>
                      <span className="tableSubtext">
                        {request.studentCode || "-"}
                      </span>
                    </td>

                    <td>
                      <span className="tablePrimaryText">
                        {request.companyName || "-"}
                      </span>
                      <span className="tableSubtext">
                        {request.companyCity || "-"}
                      </span>
                    </td>

                    <td>
                      {formatDate(request.startDate)} au{" "}
                      {formatDate(request.endDate)}
                      <span className="tableSubtext">
                        Mise a jour :{" "}
                        {formatDateTime(request.decidedAt)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`statusPill ${requestStatusClass(
                          request.status
                        )}`}
                      >
                        {requestStatusLabel(request.status)}
                      </span>
                    </td>

                    <td>
                      <div className="nextActionText">
                        <strong>{nextAction.title}</strong>
                        <span>{nextAction.detail}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredRequests.length && !loading && (
                <tr>
                  <td colSpan="5">
                    <div className="emptyState">
                      <strong>Aucune demande trouvee</strong>
                      <span>
                        Ajustez le filtre ou actualisez la
                        page.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="studentPanel">
        <div className="panelHeader">
          <div>
            <h2>Contrats de stage</h2>
            <p>{roleText(user.role)}</p>
          </div>

          <span className="statusPill">
            {loading
              ? "Chargement"
              : `${contracts.length} contrat(s)`}
          </span>
        </div>

        <div className="tableToolbar">
          <label className="tableFilter">
            Filtrer les contrats
            <select
              value={contractFilter}
              onChange={(event) =>
                setContractFilter(event.target.value)
              }
            >
              <option value="TOUS">Tous</option>
              <option value="A_COMPLETER_ETUDIANT">
                A completer
              </option>
              <option value="SIGNATURE_ETUDIANT">
                Signature etudiante
              </option>
              <option value="CONTRAT_MILIEU_A_DEPOSER">
                Depot milieu
              </option>
              <option value="SIGNATURE">
                En signature
              </option>
              <option value="DOSSIER_COMPLET">
                Complets
              </option>
              <option value="REJETE">Refuses</option>
            </select>
          </label>
        </div>

        <div className="studentTableWrap">
          <table>
            <thead>
              <tr>
                <th>Etudiant</th>
                <th>Entreprise</th>
                <th>Signatures</th>
                <th>Statut</th>
                <th>Prochaine action</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredContracts.map((contract) => {
                const nextAction =
                  contractNextAction(contract);

                return (
                  <tr key={contract.id}>
                    <td>
                      <span className="tablePrimaryText">
                        {contract.studentName || "-"}
                      </span>
                      <span className="tableSubtext">
                        {contract.studentCode || "-"}
                      </span>
                    </td>

                    <td>
                      <span className="tablePrimaryText">
                        {contract.companyName || "-"}
                      </span>
                      <span className="tableSubtext">
                        {formatDate(contract.startDate)} au{" "}
                        {formatDate(contract.endDate)}
                      </span>
                    </td>

                    <td>
                      {contract.signedCount}/
                      {contract.signerCount}
                      <span className="tableSubtext">
                        {contract.teacherName || "-"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`statusPill ${statusClass(
                          contract.status
                        )}`}
                      >
                        {statusLabel(contract.status)}
                      </span>
                    </td>

                    <td>
                      <div className="nextActionText">
                        <strong>{nextAction.title}</strong>
                        <span>{nextAction.detail}</span>
                      </div>
                    </td>

                    <td>
                      <button
                        className={
                          selectedId === contract.id
                            ? "primaryButton"
                            : "secondaryButton"
                        }
                        type="button"
                        onClick={() =>
                          setSelectedId(contract.id)
                        }
                      >
                        {selectedId === contract.id
                          ? "Ouvert"
                          : "Voir"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!filteredContracts.length && !loading && (
                <tr>
                  <td colSpan="6">
                    <div className="emptyState">
                      <strong>Aucun contrat trouve</strong>
                      <span>
                        Aucun dossier ne correspond au filtre
                        selectionne.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedContract && (
        <section className="studentPanel">
          <div className="panelHeader">
            <div>
              <h2>Suivi du contrat</h2>
              <p>
                {selectedContract.studentName} -{" "}
                {selectedContract.companyName}
              </p>
            </div>

            <span
              className={`statusPill ${statusClass(
                selectedContract.status
              )}`}
            >
              {statusLabel(selectedContract.status)}
            </span>
          </div>

          <div className="contractInfoGrid">
            <Info
              label="Etudiant"
              value={selectedContract.studentName}
            />
            <Info
              label="Code etudiant"
              value={selectedContract.studentCode}
            />
            <Info
              label="Programme"
              value={selectedContract.program}
            />
            <Info
              label="Entreprise"
              value={selectedContract.companyName}
            />
            <Info
              label="Enseignant"
              value={selectedContract.teacherName}
            />
            <Info
              label="Statut Documenso"
              value={selectedContract.documensoStatus}
            />
          </div>

          <div className="contractSignerList">
            {selectedContract.signers.map((signer) => (
              <div
                className="contractSignerItem"
                key={signer.id}
              >
                <span>{signer.signingOrder}</span>

                <div>
                  <strong>{signer.label}</strong>
                  <small>
                    {signer.name} - {signer.email}
                  </small>
                </div>

                <span
                  className={`statusPill ${signerStatusClass(
                    signer.status
                  )}`}
                >
                  {signerStatusLabel(signer.status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Notifications</h2>
          <span className="statusPill">
            {notifications.length}
          </span>
        </div>

        {notifications.map((notification) => (
          <div
            className="notificationItem"
            key={notification.id}
          >
            <span className="notificationDot" />
            <p>
              <strong>{notification.title}</strong>
              <span className="tableSubtext">
                {notification.message}
              </span>
            </p>
          </div>
        ))}

        {!notifications.length && (
          <p className="notice">
            Aucune notification pour le moment.
          </p>
        )}
      </section>
    </>
  );
}

function requestNextAction(request) {
  if (request.status === "SOUMISE") {
    return {
      title: "Decision requise",
      detail: "Ouvrir la demande et valider le contenu."
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
      title: "Correction attendue",
      detail: "L'etudiant doit resoumettre."
    };
  }

  if (request.status === "DOCUMENTS_MANQUANTS") {
    return {
      title: "Documents attendus",
      detail: "Pieces demandees a deposer."
    };
  }

  if (request.status === "APPROUVEE") {
    return {
      title: "Contrat a suivre",
      detail: "Verifier le contrat associe."
    };
  }

  return {
    title: "Suivi",
    detail: request.folderStatus || "Aucune action immediate."
  };
}

function contractNextAction(contract) {
  if (contract.status === "A_COMPLETER_ETUDIANT") {
    return {
      title: "Etudiant",
      detail: "Completer puis signer le contrat."
    };
  }

  if (contract.status === "CONTRAT_MILIEU_A_DEPOSER") {
    return {
      title: "Etudiant",
      detail: "Deposer le contrat signe par le milieu."
    };
  }

  if (isSignatureStatus(contract.status)) {
    const signer = (contract.signers || []).find(
      (candidate) =>
        candidate.status === "ENVOYE" ||
        candidate.status === "EN_ATTENTE"
    );

    return {
      title: "Signature en attente",
      detail: signer?.label || statusLabel(contract.status)
    };
  }

  if (contract.status === "DOSSIER_COMPLET") {
    return {
      title: "Termine",
      detail: "Le dossier est complet."
    };
  }

  if (contract.status === "REJETE") {
    return {
      title: "Correction requise",
      detail: "Verifier le motif et relancer le dossier."
    };
  }

  return {
    title: "Suivi",
    detail: statusLabel(contract.status)
  };
}

function Info({ label, value }) {
  return (
    <div className="requestDetailItem">
      <strong>{label}</strong>
      <span>{value || "-"}</span>
    </div>
  );
}

function roleText(role) {
  if (role === "SUPERVISEUR") {
    return "Contrats des etudiants qui vous sont assignes.";
  }

  if (role === "CONSEILLERE") {
    return "Suivi des contrats avant envoi a la direction.";
  }

  return "Suivi des contrats en attente de validation finale.";
}

function statusLabel(status) {
  const labels = {
    A_COMPLETER_ETUDIANT: "Contrat a completer",
    SIGNATURE_ETUDIANT:
      "Signature etudiante requise",
    CONTRAT_MILIEU_A_DEPOSER:
      "Contrat du milieu a deposer",
    SIGNATURE_ENTREPRISE:
      "En attente du milieu de stage",
    SIGNATURE_SUPERVISEUR:
      "En attente de l'enseignant",
    SIGNATURE_CONSEILLERE:
      "En attente de la conseillere",
    SIGNATURE_DIRECTION:
      "En attente de la direction",
    DOSSIER_COMPLET: "Signe et termine",
    REJETE: "Refuse"
  };

  return labels[status] || status || "-";
}

function statusClass(status) {
  if (status === "DOSSIER_COMPLET") {
    return "statusGreen";
  }

  if (status === "REJETE") {
    return "statusRed";
  }

  if (
    String(status || "").startsWith("SIGNATURE_") ||
    status === "CONTRAT_MILIEU_A_DEPOSER"
  ) {
    return "statusOrange";
  }

  return "statusYellow";
}

function requestStatusLabel(status) {
  const labels = {
    BROUILLON: "Brouillon",
    SOUMISE: "A traiter",
    A_REVISER: "A reviser",
    DOCUMENTS_MANQUANTS: "Documents manquants",
    APPROUVEE: "Approuvee",
    REFUSEE: "Refus definitif",
    ANNULEE: "Annulee"
  };

  return labels[status] || status || "-";
}

function requestStatusClass(status) {
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

function signerStatusLabel(status) {
  const labels = {
    EN_ATTENTE: "En attente",
    ENVOYE: "Envoye",
    SIGNE: "Signe",
    REFUSE: "Refuse",
    EXPIRE: "Expire"
  };

  return labels[status] || status || "-";
}

function signerStatusClass(status) {
  if (status === "SIGNE") {
    return "statusGreen";
  }

  if (status === "REFUSE" || status === "EXPIRE") {
    return "statusRed";
  }

  if (status === "ENVOYE") {
    return "statusOrange";
  }

  return "statusYellow";
}

function isSignatureStatus(status) {
  return String(status || "").startsWith("SIGNATURE_") ||
    status === "CONTRAT_MILIEU_A_DEPOSER";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const dateValue = String(value).slice(0, 10);
  const date = new Date(`${dateValue}T00:00:00`);

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
