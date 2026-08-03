import { useEffect, useMemo, useState } from "react";
import StudentRequestForm from "./StudentRequestForm.jsx";
import StudentRequestEditForm from "./StudentRequestEditForm.jsx";
import {
  getStudentRefusedStageRequest,
  getStudentStageDisplayState,
  isActiveStudentStageRequest,
  isCorrectionRequestStatus,
  isStudentStageLockedByRefusal,
  studentCanEditRequest,
  studentCanWithdrawRequest
} from "../utils/studentStageDisplayState.js";

const STAGE_PROGRESS_STEPS = [
  "Demande creee",
  "Demande soumise",
  "Contrat a completer",
  "Signature de l'etudiant",
  "Signature du milieu",
  "Signature de l'enseignant",
  "Signature de la conseillere",
  "Signature de la direction",
  "Dossier complet"
];

export default function StudentDashboard({
  view,
  onNavigate
}) {
  const [student, setStudent] = useState(null);
  const [requests, setRequests] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState("");
  const [contractError, setContractError] =
    useState("");
  const [loading, setLoading] = useState(true);

  const activeRequest = useMemo(
    () =>
      requests.find(isActiveStudentStageRequest) ||
      null,
    [requests]
  );
  const refusedRequest = useMemo(
    () => getStudentRefusedStageRequest(requests),
    [requests]
  );
  const stageLockedByRefusal =
    isStudentStageLockedByRefusal(requests);

  const latestRequest = useMemo(
    () =>
      refusedRequest ||
      activeRequest ||
      requests[0] ||
      null,
    [refusedRequest, activeRequest, requests]
  );

  const latestContract = useMemo(
    () =>
      contracts.find(
        (contract) =>
          latestRequest &&
          contract.requestId === latestRequest.id
      ) ||
      contracts[0] ||
      null,
    [contracts, latestRequest]
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

      const contractsResponse = await fetch(
        "/api/contracts",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const contractsData = await contractsResponse
        .json()
        .catch(() => ({}));

      if (!contractsResponse.ok) {
        setContractError(
          contractsData.error ||
            "Impossible de charger les contrats."
        );
        setContracts([]);
        return;
      }

      setContracts(contractsData.contracts || []);
      setContractError("");

      const notificationsResponse = await fetch(
        "/api/notifications",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const notificationsData =
        await notificationsResponse
          .json()
          .catch(() => ({}));

      setNotifications(
        notificationsResponse.ok
          ? notificationsData.notifications || []
          : []
      );
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

      {contractError && (
        <div className="studentError">
          {contractError}
        </div>
      )}

      {view === "requests" && (
        <RequestsView
          loading={loading}
          student={student}
          requests={requests}
          contracts={contracts}
          stageLockedByRefusal={stageLockedByRefusal}
          refusedRequest={refusedRequest}
          onCreated={loadDashboard}
          onNavigate={onNavigate}
        />
      )}

      {view === "contracts" && (
        <ContractsView
          contracts={contracts}
          requests={requests}
          stageLockedByRefusal={stageLockedByRefusal}
          refusedRequest={refusedRequest}
          onNavigate={onNavigate}
          onReload={loadDashboard}
        />
      )}

      {view === "history" && (
        <StudentHistoryView
          loading={loading}
          requests={requests}
          contracts={contracts}
        />
      )}

      {view === "dashboard" && (
        <OverviewView
          loading={loading}
          latestRequest={latestRequest}
          latestContract={latestContract}
          requests={requests}
          contracts={contracts}
          notifications={notifications}
          stageLockedByRefusal={stageLockedByRefusal}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}

function OverviewView({
  loading,
  latestRequest,
  latestContract,
  requests,
  contracts,
  notifications,
  stageLockedByRefusal,
  onNavigate
}) {
  const [downloadError, setDownloadError] =
    useState("");
  const [downloadingFinal, setDownloadingFinal] =
    useState(false);
  const [
    finalContractDownloaded,
    setFinalContractDownloaded
  ] = useState(false);

  useEffect(() => {
    if (!latestContract?.id) {
      setFinalContractDownloaded(false);
      return;
    }

    setFinalContractDownloaded(
      localStorage.getItem(
        finalContractDownloadStorageKey(
          latestContract.id
        )
      ) === "1"
    );
  }, [latestContract?.id]);

  const baseDisplayState =
    getStudentStageDisplayState({
      request: latestRequest,
      contract: latestContract
    });
  const displayState =
    finalContractDownloaded &&
    baseDisplayState.actionType === "downloadFinal"
      ? {
          ...baseDisplayState,
          nextStep:
            "Aucune action requise. Votre contrat final a ete telecharge.",
          actionLabel: "Voir mes contrats",
          actionType: "follow",
          targetView: "contracts"
        }
      : baseDisplayState;
  const missingItems =
    missingContractItems(latestContract);

  async function downloadFinalContract() {
    if (!latestContract) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setDownloadError(
        "Session expiree. Veuillez vous reconnecter."
      );
      return;
    }

    setDownloadError("");
    setDownloadingFinal(true);

    try {
      const response = await fetch(
        `/api/contracts/${latestContract.id}/download?type=signed`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));
        setDownloadError(
          data.error ||
            "Impossible de telecharger le contrat final."
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `contrat-final-${latestContract.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      localStorage.setItem(
        finalContractDownloadStorageKey(
          latestContract.id
        ),
        "1"
      );
      setFinalContractDownloaded(true);
    } catch (requestError) {
      console.error(requestError);
      setDownloadError("Erreur de connexion au serveur.");
    } finally {
      setDownloadingFinal(false);
    }
  }

  return (
    <>
      <section className="studentHeroCard">
        <div className="studentHeroHeader">
          <div>
            <h2>{displayState.title}</h2>

            <p>
              {displayState.message}
            </p>
          </div>

          <span
            className={`statusPill ${displayState.colorClass}`}
          >
            {displayState.label}
          </span>
        </div>

        <StageProgressCard
          currentStep={displayState.progressStep}
        />

        <div className="studentInfo twoColumns">
          <div>
            <strong>Milieu de stage</strong>

            <span>
              {latestRequest?.companyName ||
                "Aucun milieu sélectionné"}
            </span>
          </div>

          <div>
            <strong>Statut du contrat</strong>

            <span>
              {latestContract
                ? contractStatusLabel(
                    latestContract
                  )
                : "Aucun contrat"}
            </span>
          </div>

          <div>
            <strong>Progression des signatures</strong>

            <span>
              {signatureProgressText(
                latestContract
              )}
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
            <strong>Prochaine action</strong>

            <span className="nextActionText">
              <strong>
                {displayState.actionLabel}
              </strong>
              <small>
                {displayState.nextStep}
              </small>
            </span>
          </div>
        </div>

        {isCorrectionRequestStatus(latestRequest?.status) && (
          <div className="studentError">
            <strong>Correction demandee :</strong>{" "}
            {latestRequest.correctionStudentComment ||
              latestRequest.correctionReason}
          </div>
        )}

        {latestRequest?.refusalReason && (
          <div className="studentError">
            <strong>Refus definitif :</strong>{" "}
            {latestRequest.refusalReason}
          </div>
        )}

        {stageLockedByRefusal && (
          <div className="stageLockNotice">
            Les actions de stage sont bloquees apres
            un refus definitif. La messagerie reste
            accessible pour contacter votre superviseur
            ou la conseillere.
          </div>
        )}

        {missingItems.length > 0 && (
          <p className="notice">
            Documents ou informations a completer :{" "}
            {missingItems.join(", ")}.
          </p>
        )}

        {downloadError && (
          <div className="studentError">
            {downloadError}
          </div>
        )}

        <div className="studentFormActions">
          <button
            className="primaryButton fitButton"
            type="button"
            onClick={() => {
              if (
                displayState.actionType ===
                "downloadFinal"
              ) {
                downloadFinalContract();
                return;
              }

              onNavigate(displayState.targetView);
            }}
          >
            {displayState.actionLabel}
          </button>

          {latestContract?.signedPdfAvailable &&
            displayState.actionType !==
              "downloadFinal" && (
            <button
              className="secondaryButton fitButton"
              type="button"
              disabled={downloadingFinal}
              onClick={downloadFinalContract}
            >
              {downloadingFinal
                ? "Telechargement..."
                : "Telecharger le contrat final"}
            </button>
          )}
        </div>
      </section>

      <div className="studentDashboardGrid">
        <ContractsSummary
          contracts={contracts}
          requests={requests}
          onNavigate={onNavigate}
        />

        <NotificationsSummary
          latestRequest={latestRequest}
          notifications={notifications}
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
  contracts,
  stageLockedByRefusal,
  refusedRequest,
  onCreated,
  onNavigate
}) {
  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [editingRequest, setEditingRequest] =
    useState(null);
  const [withdrawError, setWithdrawError] =
    useState("");
  const [withdrawingId, setWithdrawingId] =
    useState(null);

  const activeRequest = useMemo(
    () =>
      requests.find(isActiveStudentStageRequest) ||
      null,
    [requests]
  );

  const historyRequests = useMemo(
    () => studentHistoryRequests(requests),
    [requests]
  );

  const activeContract = useMemo(
    () =>
      contracts.find(
        (contract) =>
          activeRequest &&
          contract.requestId === activeRequest.id
      ) || null,
    [contracts, activeRequest]
  );

  useEffect(() => {
    if (stageLockedByRefusal) {
      setEditingRequest(null);
    }
  }, [stageLockedByRefusal]);

  async function handleUpdated() {
    await onCreated();
    setEditingRequest(null);
    setSelectedRequest(null);
  }

  async function withdrawRequest(request) {
    const confirmed = window.confirm(
      "Retirer cette demande de stage ?\n\nCette demande ne sera plus active et vous pourrez en creer une nouvelle. Elle restera conservee dans votre historique administratif."
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setWithdrawError("Session expiree.");
      return;
    }

    setWithdrawingId(request.id);
    setWithdrawError("");

    try {
      const response = await fetch(
        `/api/students/requests/${request.id}/withdraw`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            reason: "Retiree par l'etudiant."
          })
        }
      );
      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setWithdrawError(
          data.error ||
            "Impossible de retirer cette demande."
        );
        return;
      }

      await onCreated();
      setEditingRequest(null);
      setSelectedRequest(null);
    } catch (requestError) {
      console.error(requestError);
      setWithdrawError(
        "Erreur de connexion au serveur."
      );
    } finally {
      setWithdrawingId(null);
    }
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

      {stageLockedByRefusal ? (
        <StageRefusalLockPanel
          request={refusedRequest}
          onNavigate={onNavigate}
        />
      ) : editingRequest ? (
        <StudentRequestEditForm
          request={editingRequest}
          onUpdated={handleUpdated}
          onCancel={() =>
            setEditingRequest(null)
          }
        />
      ) : (
        <>
          {activeRequest ? (
            <ActiveRequestCard
              request={activeRequest}
              contract={activeContract}
              withdrawing={
                withdrawingId === activeRequest.id
              }
              onSelect={setSelectedRequest}
              onEdit={setEditingRequest}
              onWithdraw={withdrawRequest}
              onNavigate={onNavigate}
            />
          ) : (
            <StudentRequestForm
              student={student}
              onCreated={onCreated}
            />
          )}

          {withdrawError && (
            <div className="studentError">
              {withdrawError}
            </div>
          )}
        </>
      )}

      <RequestHistoryTable
        requests={historyRequests}
        selectedRequest={selectedRequest}
        onSelect={setSelectedRequest}
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

function StudentHistoryView({
  loading,
  requests,
  contracts
}) {
  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const historyRequests = useMemo(
    () => studentHistoryRequests(requests),
    [requests]
  );
  const completedContracts = contracts.filter(
    (contract) =>
      contract.status === "DOSSIER_COMPLET" ||
      contract.folderStatus === "DOSSIER_COMPLET"
  );
  const refusedRequests = historyRequests.filter(
    (request) =>
      effectiveRequestStatus(request) === "REFUSEE"
  );

  return (
    <>
      <section className="studentPanel">
        <div className="panelHeader">
          <div>
            <h2>Historique étudiant</h2>
            <p>
              Les demandes terminées, retirées ou
              refusées restent consultables ici.
            </p>
          </div>

          {loading && (
            <span className="statusPill">
              Chargement
            </span>
          )}
        </div>

        <div className="studentInfo twoColumns">
          <div>
            <strong>Demandes archivées</strong>
            <span>{historyRequests.length}</span>
          </div>

          <div>
            <strong>Dossiers complets</strong>
            <span>{completedContracts.length}</span>
          </div>

          <div>
            <strong>Demandes refusées</strong>
            <span>{refusedRequests.length}</span>
          </div>

          <div>
            <strong>Dernière activité</strong>
            <span>
              {formatDateTime(
                historyRequests[0]?.withdrawnAt ||
                  historyRequests[0]?.decidedAt ||
                  historyRequests[0]?.updatedAt ||
                  historyRequests[0]?.createdAt
              )}
            </span>
          </div>
        </div>
      </section>

      <RequestHistoryTable
        requests={historyRequests}
        selectedRequest={selectedRequest}
        onSelect={setSelectedRequest}
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

function StageRefusalLockPanel({
  request,
  onNavigate,
  title = "Dossier de stage bloque"
}) {
  return (
    <section className="studentPanel stageLockPanel">
      <div className="panelHeader">
        <div>
          <h2>{title}</h2>
          <p>
            Un refus definitif bloque les nouvelles
            demandes, les modifications, les depots de
            documents et les actions de contrat.
          </p>
        </div>

        <span className="statusPill statusRed">
          Demande refusee
        </span>
      </div>

      <div className="stageLockMeta">
        <div>
          <strong>Demande concernee</strong>
          <span>
            {request?.companyName ||
              `Demande #${request?.id || "-"}`}
          </span>
        </div>

        <div>
          <strong>Date du refus</strong>
          <span>
            {formatDateTime(
              request?.decidedAt ||
                request?.updatedAt ||
                request?.createdAt
            )}
          </span>
        </div>
      </div>

      <div className="studentError">
        <strong>Motif du refus definitif :</strong>{" "}
        {request?.refusalReason ||
          "Aucun motif detaille n'est disponible."}
      </div>

      <div className="stageLockActions">
        <button
          className="primaryButton fitButton"
          type="button"
          onClick={() => onNavigate("messages")}
        >
          Ouvrir la messagerie
        </button>
      </div>
    </section>
  );
}

function ContractsView({
  contracts,
  requests,
  stageLockedByRefusal,
  refusedRequest,
  onNavigate,
  onReload
}) {
  const [selectedContractId, setSelectedContractId] =
    useState(null);

  useEffect(() => {
    if (!selectedContractId && contracts[0]) {
      setSelectedContractId(contracts[0].id);
    }
  }, [contracts, selectedContractId]);

  const selectedContract = useMemo(
    () =>
      contracts.find(
        (contract) =>
          contract.id === selectedContractId
      ) || contracts[0],
    [contracts, selectedContractId]
  );

  if (stageLockedByRefusal) {
    return (
      <StageRefusalLockPanel
        request={refusedRequest}
        onNavigate={onNavigate}
        title="Contrats bloques"
      />
    );
  }

  return (
    <>
      <ContractsSummary
        contracts={contracts}
        requests={requests}
        onNavigate={onNavigate}
        expanded
      />

      <section className="studentPanel">
        <div className="panelHeader">
          <h2>Documents de contrat</h2>

          <span className="statusPill">
            {contracts.length} contrat(s)
          </span>
        </div>

        {contracts.length > 1 && (
          <div className="contractSelector">
            <label htmlFor="contractSelect">
              Contrat
            </label>

            <select
              id="contractSelect"
              value={selectedContract?.id || ""}
              onChange={(event) =>
                setSelectedContractId(
                  Number(event.target.value)
                )
              }
            >
              {contracts.map((contract) => (
                <option
                  key={contract.id}
                  value={contract.id}
                >
                  {contract.companyName || "Contrat"} -{" "}
                  {contractStatusLabel(contract)}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedContract ? (
          <ContractDetails
            contract={selectedContract}
            onReload={onReload}
          />
        ) : (
          <p className="notice">
            Aucun contrat disponible pour le moment.
          </p>
        )}
      </section>
    </>
  );
}

function ContractDetails({
  contract,
  onReload
}) {
  const [formData, setFormData] = useState(() =>
    contractToForm(contract)
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [uploadingMilieu, setUploadingMilieu] =
    useState(false);
  const [syncingDocumenso, setSyncingDocumenso] =
    useState(false);
  const [receipt, setReceipt] = useState(
    contract.receipt || null
  );
  const [downloading, setDownloading] =
    useState("");
  const [previousContractId, setPreviousContractId] =
    useState(contract.id);

  useEffect(() => {
    setFormData(contractToForm(contract));
    if (previousContractId !== contract.id) {
      setMessage("");
      setError("");
      setPreviousContractId(contract.id);
    }
    setReceipt(contract.receipt || null);
  }, [contract, previousContractId]);

  const isEditable =
    contract.status === "A_COMPLETER_ETUDIANT";

  const currentSigner = !isEditable
    ? contract.signers?.find((signer) =>
        ["ENVOYE", "EN_ATTENTE"].includes(
          signer.status
        )
      )
    : null;

  const studentSigner = contract.signers?.find(
    (signer) =>
      signer.role === "ETUDIANT" &&
      signer.status === "ENVOYE"
  );

  const canUploadMilieuContract =
    contract.status === "CONTRAT_MILIEU_A_DEPOSER";
  const isMilieuDocumensoSignaturePending =
    contract.status === "SIGNATURE_ENTREPRISE";
  const canDownloadMilieuPdf =
    !canUploadMilieuContract ||
    contract.studentSignedPdfAvailable;
  const canSyncDocumenso =
    Boolean(contract.documensoDocumentId) &&
    String(contract.status || "").startsWith(
      "SIGNATURE_"
    );
  const confirmationCode =
    receipt?.confirmationCode ||
    contract.confirmationCode;

  function updateField(name, value) {
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function saveContractData(token) {
    const response = await fetch(
      `/api/contracts/${contract.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      }
    );

    const data = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Impossible d'enregistrer le contrat."
      );
    }

    return data;
  }

  async function saveContract() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await saveContractData(token);
      await onReload();
      setMessage(
        "Enregistrement fait avec succes. Generez le PDF seulement lorsque le contrat est pret."
      );
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError.message ||
          "Erreur de connexion au serveur."
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateContractPdf() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    setGeneratingPdf(true);
    setError("");
    setMessage("");

    try {
      await saveContractData(token);

      const response = await fetch(
        `/api/contracts/${contract.id}/generate-pdf`,
        {
          method: "POST",
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
            "Impossible de generer le PDF."
        );
        return;
      }

      await onReload();
      setMessage(
        "Le PDF du contrat a ete genere et ajoute aux documents du dossier."
      );
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError.message ||
          "Erreur de connexion au serveur."
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function submitContract() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await saveContractData(token);

      const response = await fetch(
        `/api/contracts/${contract.id}/submit`,
        {
          method: "POST",
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
          formatContractSubmissionError(data)
        );
        return;
      }

      await onReload();
      setMessage(
        "Le contrat a ete envoye dans Documenso. Ouvrez le lien pour signer votre partie."
      );
    } catch (requestError) {
      console.error(requestError);
      setError(
        requestError.message ||
          "Erreur de connexion au serveur."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadMilieuSignedDocument(event) {
    event.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    const file =
      event.currentTarget.elements
        .milieuSignedDocument?.files?.[0];

    if (!file) {
      setError(
        "Le PDF signe par le milieu est obligatoire."
      );
      return;
    }

    const payload = new FormData();
    payload.append("file", file);

    setUploadingMilieu(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/contracts/${contract.id}/milieu-signed-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: payload
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de deposer le contrat signe par le milieu."
        );
        return;
      }

      setReceipt(data.contract?.receipt || null);
      await onReload();
      setMessage(
        data.contract?.documensoWarning
          ? `Contrat signe par le milieu recu. ${data.contract.documensoWarning}`
          : "Contrat signe par le milieu recu. La signature electronique de l'enseignant est lancee."
      );
      event.currentTarget.reset();
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setUploadingMilieu(false);
    }
  }

  async function syncDocumensoStatus() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    setSyncingDocumenso(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/contracts/${contract.id}/sync-documenso`,
        {
          method: "POST",
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
            "Impossible d'actualiser le statut Documenso."
        );
        return;
      }

      await onReload();
      setReceipt(data.contract?.receipt || null);
      setMessage("Statut Documenso actualise.");
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setSyncingDocumenso(false);
    }
  }

  async function downloadContract(type) {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    setDownloading(type);
    setError("");

    try {
      const response = await fetch(
        `/api/contracts/${contract.id}/download?type=${type}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        const data = await response
          .json()
          .catch(() => ({}));
        setError(
          data.error ||
            "Impossible de telecharger le document."
        );
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-contrat-${contract.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="contractDetails">
      <div className="contractStatusHeader">
        <div>
          <strong>
            {contract.companyName || "Contrat"}
          </strong>
          <span>
            {formatDate(contract.startDate)} au{" "}
            {formatDate(contract.endDate)}
          </span>
        </div>

        <span
          className={`statusPill ${contractStatusClass(
            contract
          )}`}
        >
          {contractStatusLabel(contract)}
        </span>
      </div>

      {contract.documensoMessage && (
        <p className="notice">
          {contract.documensoMessage}
        </p>
      )}

      {studentSigner && (
        <p className="notice">
          Une signature est en attente pour votre
          courriel.
        </p>
      )}

      {currentSigner && !studentSigner && (
        <p className="notice">
          Signature en attente :{" "}
          {currentSigner.label}.
        </p>
      )}

      {canUploadMilieuContract && (
        <p className="notice">
          Telechargez le PDF signe par vous, faites-le
          signer par le milieu de stage en presentiel,
          puis deposez le PDF signe ici.
        </p>
      )}

      {isMilieuDocumensoSignaturePending && (
        <p className="notice">
          Le contrat est en attente de la signature
          Documenso du milieu de stage.
        </p>
      )}

      {canUploadMilieuContract &&
        !contract.studentSignedPdfAvailable && (
          <p className="notice">
            Le PDF signe par l'etudiant est en cours de
            reception depuis Documenso. Rechargez le dossier
            dans quelques instants.
          </p>
        )}

      {message && (
        <div className="studentSuccess">
          {message}
        </div>
      )}

      {error && (
        <div className="studentError">
          {error}
        </div>
      )}

      <div className="contractSection">
        <h3>Donnees reprises de la demande</h3>

        <div className="contractReadOnlyGrid">
          <ContractReadOnlyItem
            label="Etudiant"
            value={`${contract.studentFirstName || ""} ${
              contract.studentLastName || ""
            }`.trim()}
          />
          <ContractReadOnlyItem
            label="Code etudiant"
            value={contract.studentCode}
          />
          <ContractReadOnlyItem
            label="Code permanent"
            value={contract.studentPermanentCode}
          />
          <ContractReadOnlyItem
            label="Programme"
            value={contract.program}
          />
          <ContractReadOnlyItem
            label="Groupe"
            value={contract.studentGroup}
          />
          <ContractReadOnlyItem
            label="Courriel etudiant"
            value={contract.studentEmail}
          />
          <ContractReadOnlyItem
            label="Telephone etudiant"
            value={contract.studentPhone}
          />
          <ContractReadOnlyItem
            label="Adresse etudiant"
            value={formatAddress(
              contract.studentAddress,
              contract.studentCity,
              contract.studentProvince,
              contract.studentPostalCode
            )}
            wide
          />
          <ContractReadOnlyItem
            label="Milieu de stage"
            value={contract.companyName}
          />
          <ContractReadOnlyItem
            label="NEQ"
            value={contract.companyNeq}
          />
          <ContractReadOnlyItem
            label="Adresse du milieu"
            value={formatAddress(
              contract.companyAddress,
              contract.companyCity,
              contract.companyProvince,
              contract.companyPostalCode
            )}
            wide
          />
          <ContractReadOnlyItem
            label="Telephone du milieu"
            value={formatPhoneWithExtension(
              contract.companyPhone,
              contract.companyPhoneExtension
            )}
          />
          <ContractReadOnlyItem
            label="Courriel du milieu"
            value={contract.companyEmail}
          />
          <ContractReadOnlyItem
            label="Site Internet"
            value={contract.companyWebsite}
          />
          <ContractReadOnlyItem
            label="Type d'organisation"
            value={organizationTypeLabel(
              contract.organizationType
            )}
          />
          <ContractReadOnlyItem
            label="Secteur d'activite"
            value={contract.businessSector}
          />
          <ContractReadOnlyItem
            label="Superviseur en entreprise"
            value={contract.companySupervisorName}
          />
          <ContractReadOnlyItem
            label="Titre du superviseur"
            value={contract.companySupervisorTitle}
          />
          <ContractReadOnlyItem
            label="Courriel du superviseur"
            value={contract.companySupervisorEmail}
          />
          <ContractReadOnlyItem
            label="Telephone du superviseur"
            value={contract.companySupervisorPhone}
          />
          <ContractReadOnlyItem
            label="Enseignant"
            value={`${contract.teacherFirstName || ""} ${
              contract.teacherLastName || ""
            }`.trim()}
          />
        </div>
      </div>

      <div className="contractSection">
        <h3>Informations a completer</h3>
        <p className="requiredHint">* Champ obligatoire</p>

        <div className="contractFormGrid">
        <ContractField label="Annee scolaire *">
          <input
            value={formData.schoolYear}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "schoolYear",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Session *">
          <input
            value={formData.session}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "session",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Code programme *">
          <input
            value={formData.codeProgram}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "codeProgram",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Type d'horaire *">
          <select
            value={formData.scheduleType}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "scheduleType",
                event.target.value
              )
            }
          >
            <option value="">Choisir</option>
            <option value="TEMPS_PLEIN">
              Temps plein
            </option>
            <option value="TEMPS_PARTIEL">
              Temps partiel
            </option>
          </select>
        </ContractField>

        <ContractField label="Heures par semaine *">
          <input
            type="number"
            min="0"
            step="0.25"
            value={formData.hoursPerWeek}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "hoursPerWeek",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Nombre de semaines *">
          <input
            type="number"
            min="0"
            step="0.25"
            value={formData.numberOfWeeks}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "numberOfWeeks",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Fonction de stage *" wide>
          <input
            value={formData.functionStage}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "functionStage",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Description du stage *" wide>
          <textarea
            rows="5"
            value={formData.descriptionStage}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "descriptionStage",
                event.target.value
              )
            }
          />
        </ContractField>

        <label className="contractCheck">
          <input
            type="checkbox"
            checked={formData.isPaid}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "isPaid",
                event.target.checked
              )
            }
          />
          Stage remunere
        </label>

        {formData.isPaid && (
          <ContractField label="Salaire horaire *">
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.hourlySalary}
              disabled={!isEditable}
              onChange={(event) =>
                updateField(
                  "hourlySalary",
                  event.target.value
                )
              }
            />
          </ContractField>
        )}

        <ContractField
          label="Compensation monetaire"
          wide
        >
          <input
            value={formData.monetaryCompensation}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "monetaryCompensation",
                event.target.value
              )
            }
          />
        </ContractField>

        <ContractField label="Autre compensation" wide>
          <input
            value={formData.otherCompensation}
            disabled={!isEditable}
            onChange={(event) =>
              updateField(
                "otherCompensation",
                event.target.value
              )
            }
          />
        </ContractField>
        </div>
      </div>

      <div className="contractSection">
        <h3>Progression du dossier</h3>

        <ContractWorkflowProgress contract={contract} />
      </div>

      <div className="contractSection">
        <h3>Progression des signatures</h3>

        <SignatureProgress
          signers={contract.signers || []}
        />
      </div>

      <div className="contractActions">
        {isEditable && (
          <button
            className="secondaryButton"
            type="button"
            disabled={
              saving ||
              generatingPdf ||
              submitting ||
              uploadingMilieu ||
              syncingDocumenso
            }
            onClick={saveContract}
          >
            {saving
              ? "Enregistrement..."
              : "Enregistrer"}
          </button>
        )}

        {isEditable && (
          <button
            className="secondaryButton"
            type="button"
            disabled={
              saving ||
              generatingPdf ||
              submitting ||
              uploadingMilieu ||
              syncingDocumenso
            }
            onClick={generateContractPdf}
          >
            {generatingPdf
              ? "Generation..."
              : "Generer le PDF"}
          </button>
        )}

        {isEditable && (
          <button
            className="primaryButton"
            type="button"
            disabled={
              saving ||
              generatingPdf ||
              submitting ||
              uploadingMilieu ||
              syncingDocumenso
            }
            onClick={submitContract}
          >
            {submitting
              ? "Envoi..."
              : "Enregistrer et envoyer pour signature"}
          </button>
        )}

        {studentSigner?.signingUrl && (
          <button
            className="primaryButton"
            type="button"
            onClick={() =>
              window.open(
                studentSigner.signingUrl,
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            Signer le contrat
          </button>
        )}

        {canSyncDocumenso && (
          <button
            className="secondaryButton"
            type="button"
            disabled={syncingDocumenso}
            onClick={syncDocumensoStatus}
          >
            {syncingDocumenso
              ? "Actualisation..."
              : "Actualiser Documenso"}
          </button>
        )}

        {contract.generatedPdfAvailable &&
          canDownloadMilieuPdf && (
            <button
              className="secondaryButton"
              type="button"
              disabled={Boolean(downloading)}
              onClick={() =>
                downloadContract("original")
              }
            >
              {downloading === "original"
                ? "Telechargement..."
                : canUploadMilieuContract
                  ? "Telecharger le PDF a signer par le milieu"
                  : "Telecharger le PDF"}
            </button>
          )}

        {contract.signedPdfAvailable && (
          <button
            className="secondaryButton"
            type="button"
            disabled={Boolean(downloading)}
            onClick={() => downloadContract("signed")}
          >
            {downloading === "signed"
              ? "Telechargement..."
              : "Telecharger le PDF signe"}
          </button>
        )}
      </div>

      {canUploadMilieuContract && (
        <form
          className="contractUploadForm"
          onSubmit={uploadMilieuSignedDocument}
        >
          <ContractField
            label="PDF signe par le milieu *"
            wide
          >
            <input
              type="file"
              name="milieuSignedDocument"
              accept="application/pdf"
              disabled={
                uploadingMilieu ||
                syncingDocumenso
              }
              required
            />
          </ContractField>

          <button
            className="primaryButton fitButton"
            type="submit"
            disabled={
              uploadingMilieu ||
              syncingDocumenso
            }
          >
            {uploadingMilieu
              ? "Depot..."
              : "Deposer le PDF signe"}
          </button>
        </form>
      )}

      {confirmationCode && (
        <div className="receiptPanel">
          <strong>
            Votre contrat signe a ete recu avec succes.
          </strong>
          <ReceiptBarcode value={confirmationCode} />
          <span>
            Code de confirmation : {confirmationCode}
          </span>
          <span>
            Date de reception :{" "}
            {formatDateTime(
              receipt?.receivedAt ||
                contract.milieuSignedReceivedAt
            )}
          </span>
          <span>
            Prochaine etape :{" "}
            {receipt?.nextStep ||
              "Signature electronique interne"}
          </span>
        </div>
      )}
    </div>
  );
}

function ContractField({
  label,
  children,
  wide = false
}) {
  return (
    <label
      className={`contractField ${
        wide ? "contractFieldWide" : ""
      }`}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

function ContractReadOnlyItem({
  label,
  value,
  wide = false
}) {
  return (
    <div
      className={`contractReadOnlyItem ${
        wide ? "contractReadOnlyWide" : ""
      }`}
    >
      <strong>{label}</strong>
      <span>{displayValue(value)}</span>
    </div>
  );
}

function ReceiptBarcode({ value }) {
  const bars = Array.from(String(value || ""))
    .flatMap((character) => {
      const code = character.charCodeAt(0);
      return [1, 2, 3].map((offset) => ({
        width: code % (offset + 2) === 0 ? 3 : 1,
        active: (code + offset) % 2 === 0
      }));
    })
    .filter((bar) => bar.active)
    .slice(0, 42);

  return (
    <div
      className="receiptBarcode"
      aria-label={`Code de confirmation ${value}`}
    >
      {bars.map((bar, index) => (
        <span
          key={`${value}-${index}`}
          style={{ width: `${bar.width}px` }}
        />
      ))}
    </div>
  );
}

function SignatureProgress({ signers }) {
  return (
    <div className="contractSignerList">
      {signers.map((signer) => (
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

      {!signers.length && (
        <p className="notice">
          Les signataires seront prepares au moment
          de l'envoi.
        </p>
      )}
    </div>
  );
}

function contractToForm(contract) {
  return {
    schoolYear: formValue(contract.schoolYear),
    session: formValue(contract.session),
    codeProgram: formValue(contract.codeProgram),
    functionStage: formValue(contract.functionStage),
    descriptionStage: formValue(
      contract.descriptionStage ||
        contract.taskSummary
    ),
    isPaid: Boolean(contract.isPaid),
    hourlySalary: formValue(contract.hourlySalary),
    monetaryCompensation: formValue(
      contract.monetaryCompensation
    ),
    otherCompensation: formValue(
      contract.otherCompensation
    ),
    hoursPerWeek: formValue(contract.hoursPerWeek),
    numberOfWeeks: formValue(
      contract.numberOfWeeks
    ),
    scheduleType: formValue(contract.scheduleType)
  };
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

      <div>
        <strong>Telephone</strong>

        <span>{student?.phone || "-"}</span>
      </div>

      <div>
        <strong>Adresse</strong>

        <span>
          {formatAddress(
            student?.address,
            student?.city,
            student?.province,
            student?.postalCode
          )}
        </span>
      </div>

      <div>
        <strong>Expiration CAQ</strong>

        <span>
          {formatDate(student?.expirationCaq)}
        </span>
      </div>

      <div>
        <strong>Expiration permis d'etudes</strong>

        <span>
          {formatDate(
            student?.expirationStudyPermit
          )}
        </span>
      </div>

      <div>
        <strong>Expiration assurance</strong>

        <span>
          {formatDate(
            student?.expirationInsurance
          )}
        </span>
      </div>
    </div>
  );
}

function ActiveRequestCard({
  request,
  contract,
  withdrawing,
  onSelect,
  onEdit,
  onWithdraw,
  onNavigate
}) {
  const displayState =
    getStudentStageDisplayState({
      request,
      contract
    });
  const primaryActionShowsRequest =
    displayState.actionType === "view" &&
    displayState.targetView === "requests";

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <div>
          <h2>Ma demande de stage</h2>
          <p>{displayState.message}</p>
        </div>

        <span
          className={`statusPill ${displayState.colorClass}`}
        >
          {displayState.label}
        </span>
      </div>

      <div className="studentInfo twoColumns">
        <div>
          <strong>Entreprise</strong>
          <span>
            {request.companyName || "-"}
          </span>
        </div>

        <div>
          <strong>Derniere mise a jour</strong>
          <span>
            {formatDateTime(
              request.updatedAt ||
                request.resubmittedAt ||
                request.createdAt
            )}
          </span>
        </div>

        <div>
          <strong>Statut lisible</strong>
          <span>{displayState.label}</span>
        </div>

        <div>
          <strong>Prochaine etape</strong>
          <span>{displayState.nextStep}</span>
        </div>
      </div>

      {isCorrectionRequestStatus(request.status) && (
        <div className="studentError">
          <strong>Commentaire :</strong>{" "}
          {request.correctionStudentComment ||
            request.correctionReason ||
            "-"}
          <div className="correctionMeta">
            <span>
              Demandee le{" "}
              {formatDateTime(
                request.correctionRequestedAt
              )}
            </span>
            <span>
              Elements :{" "}
              {request.correctionItems || "-"}
            </span>
            <span>
              Documents :{" "}
              {formatDocumentTypes(
                request.correctionMissingDocuments
              )}
            </span>
          </div>
        </div>
      )}

      <StageProgressCard
        currentStep={displayState.progressStep}
        compact
      />

      <div className="studentFormActions">
        <button
          className="primaryButton"
          type="button"
          onClick={() => {
            if (studentCanEditRequest(request)) {
              onEdit(request);
              return;
            }

            if (
              displayState.targetView === "contracts"
            ) {
              onNavigate("contracts");
              return;
            }

            onSelect(request);
          }}
        >
          {displayState.actionLabel}
        </button>

        {!primaryActionShowsRequest && (
          <button
            className="secondaryButton"
            type="button"
            onClick={() => onSelect(request)}
          >
            Voir ma demande
          </button>
        )}

        {studentCanEditRequest(request) && (
          <button
            className="secondaryButton"
            type="button"
            onClick={() => onEdit(request)}
          >
            Modifier ma demande
          </button>
        )}

        {studentCanWithdrawRequest(request) && (
          <button
            className="secondaryButton"
            type="button"
            disabled={withdrawing}
            onClick={() => onWithdraw(request)}
          >
            {withdrawing
              ? "Retrait..."
              : "Retirer ma demande"}
          </button>
        )}
      </div>
    </section>
  );
}

function RequestHistoryTable({
  requests,
  selectedRequest,
  onSelect
}) {
  async function downloadRequestPdf(request) {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `/api/students/requests/${request.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `demande-stage-${request.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      console.error(requestError);
    }
  }

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Historique de mes demandes</h2>

        <span className="statusPill">
          {requests.length} demande(s)
        </span>
      </div>

      <div className="studentTableWrap">
        <table>
          <thead>
            <tr>
              <th>Creation</th>
              <th>Entreprise</th>
              <th>Statut final</th>
              <th>Date finale</th>
              <th>Motif</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {requests.map((request) => {
              return (
                <tr key={request.id}>
                  <td>
                    {formatDate(request.createdAt)}
                  </td>

                  <td>
                    <span className="tablePrimaryText">
                      {request.companyName || "-"}
                    </span>
                    <small>
                      {request.companyCity || "-"} -{" "}
                      {scheduleTypeLabel(
                        request.scheduleType
                      )}
                    </small>
                  </td>

                  <td>
                    <span
                      className={`statusPill ${statusClass(
                        effectiveRequestStatus(request)
                      )}`}
                    >
                      {statusLabel(
                        effectiveRequestStatus(request)
                      )}
                    </span>
                  </td>

                  <td>
                    {formatDateTime(
                      request.withdrawnAt ||
                        request.decidedAt ||
                        request.updatedAt ||
                        request.createdAt
                    )}
                  </td>

                  <td>
                    {request.withdrawalReason ||
                      request.refusalReason ||
                      "-"}
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

                      {canDownloadRequestPdf(request) && (
                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() =>
                            downloadRequestPdf(request)
                          }
                        >
                          PDF demande
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
                  <div className="emptyState">
                    Aucune demande dans l'historique.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function studentHistoryRequests(requests) {
  return requests.filter(
    (request) =>
      !isActiveStudentStageRequest(request)
  );
}

function canDownloadRequestPdf(request) {
  return ![
    "BROUILLON",
    "A_REVISER",
    "DOCUMENTS_MANQUANTS",
    "REFUSEE",
    "ANNULEE"
  ].includes(request?.status);
}

function effectiveRequestStatus(request) {
  if (
    request?.folderStatus === "DOSSIER_COMPLET"
  ) {
    return "DOSSIER_COMPLET";
  }

  return request?.status;
}

function ContractWorkflowProgress({ contract }) {
  const currentStep = progressStep(
    contract.requestStatus,
    contract
  );
  const steps = [
    "Demande approuvee",
    "Contrat genere",
    "Contrat complete",
    "Signature de l'etudiant",
    "PDF du milieu depose",
    "Signature de l'enseignant",
    "Signature de la conseillere",
    "Signature de la direction",
    "Dossier complet"
  ];

  return (
    <StageProgressTimeline
      currentStep={currentStep}
      steps={steps}
    />
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
              effectiveRequestStatus(request)
            )}`}
          >
            {statusLabel(effectiveRequestStatus(request))}
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

      {isCorrectionStatus(request.status) && (
        <div className="studentError">
          <strong>Correction demandee :</strong>{" "}
          {request.correctionStudentComment ||
            request.correctionReason}
        </div>
      )}

      {request.refusalReason && (
        <div className="studentError">
          <strong>Motif du refus definitif :</strong>{" "}
          {request.refusalReason}
        </div>
      )}

      {request.correctionReason && (
        <DetailsSection title="Correction demandee">
          <DetailItem
            label="Raison"
            value={request.correctionReason}
            wide
          />
          <DetailItem
            label="Elements a corriger"
            value={request.correctionItems}
            wide
          />
          <DetailItem
            label="Documents manquants"
            value={formatDocumentTypes(
              request.correctionMissingDocuments
            )}
            wide
          />
          <DetailItem
            label="Demandee le"
            value={formatDateTime(
              request.correctionRequestedAt
            )}
          />
          <DetailItem
            label="Demandee par"
            value={
              request.correctionRequestedByLabel ||
              request.correctionRequestedByRole
            }
          />
        </DetailsSection>
      )}

      <DetailsSection title="Informations de l'etudiant">
        <DetailItem
          label="Telephone"
          value={request.studentPhone}
        />

        <DetailItem
          label="Adresse"
          value={formatAddress(
            request.studentAddress,
            request.studentCity,
            request.studentProvince,
            request.studentPostalCode
          )}
          wide
        />

        <DetailItem
          label="Expiration CAQ"
          value={formatDate(request.expirationCaq)}
        />

        <DetailItem
          label="Expiration permis d'etudes"
          value={formatDate(
            request.expirationStudyPermit
          )}
        />

        <DetailItem
          label="Expiration assurance"
          value={formatDate(
            request.expirationInsurance
          )}
        />
      </DetailsSection>

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
          label="Province"
          value={request.companyProvince}
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

function finalContractDownloadStorageKey(contractId) {
  return `stagetec-final-contract-downloaded-${contractId}`;
}

function ContractsSummary({
  contracts = [],
  requests,
  onNavigate,
  expanded = false
}) {
  const fallbackRequests = requests.filter(
    (request) =>
      [
        "APPROUVEE",
        "CONTRAT_EN_COURS",
        "DOSSIER_COMPLET"
      ].includes(request.status)
  );

  const summaryRows = contracts.length
    ? contracts
    : fallbackRequests.map((request) => ({
        id: `request-${request.id}`,
        companyName: request.companyName,
        startDate: request.startDate,
        endDate: request.endDate,
        status: request.status
      }));

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Mes contrats</h2>

        <span className="statusPill">
          {summaryRows.length}
        </span>
      </div>

      {summaryRows.map((contract) => (
        <div
          className="contractRow"
          key={contract.id}
        >
          <span
            className={`contractDot ${contractStatusClass(
              contract
            )}`}
          />

          <div>
            <strong>
              {contract.companyName}
            </strong>

            <span>
              {formatDate(
                contract.startDate
              )}{" "}
              au{" "}
              {formatDate(contract.endDate)}
            </span>
          </div>

          <span
            className={`statusPill ${contractStatusClass(
              contract
            )}`}
          >
            {contractStatusLabel(contract)}
          </span>
        </div>
      ))}

      {!summaryRows.length && (
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
  latestRequest,
  notifications = []
}) {
  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Notifications</h2>

        <span className="statusPill">
          {notifications.length || (latestRequest ? 1 : 0)}
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
      )}
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
          Demande non creee
        </span>

        <span>
          <i className="legendDot statusOrange" />
          Processus en cours
        </span>

        <span>
          <i className="legendDot statusRed" />
          Correction, document manquant ou refus
        </span>

        <span>
          <i className="legendDot statusGreen" />
          Dossier complet et approuve
        </span>
      </div>
    </section>
  );
}

function StageProgressCard({
  currentStep,
  compact = false
}) {
  const safeStep = clampProgressStep(
    currentStep,
    STAGE_PROGRESS_STEPS.length
  );
  const percentage = Math.round(
    (safeStep / STAGE_PROGRESS_STEPS.length) * 100
  );

  return (
    <div
      className={`stageProgressCard ${
        compact ? "stageProgressCompact" : ""
      }`}
    >
      <div className="studentProgressRow">
        <span>Progression du dossier</span>

        <strong>
          Etape {safeStep}/{STAGE_PROGRESS_STEPS.length}
        </strong>
      </div>

      <div
        className="studentProgressTrack"
        role="progressbar"
        aria-label="Progression du dossier"
        aria-valuemin="1"
        aria-valuemax={STAGE_PROGRESS_STEPS.length}
        aria-valuenow={safeStep}
      >
        <span
          style={{
            width: `${percentage}%`
          }}
        />
      </div>

      <StageProgressTimeline
        currentStep={safeStep}
        steps={STAGE_PROGRESS_STEPS}
      />
    </div>
  );
}

function StageProgressTimeline({
  currentStep,
  steps
}) {
  const safeStep = clampProgressStep(
    currentStep,
    steps.length
  );

  return (
    <ol className="stageProgressTimeline">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isFinalCompleted =
          safeStep === steps.length &&
          stepNumber === safeStep;
        const className =
          stepNumber < safeStep || isFinalCompleted
            ? "workflowStepDone"
            : stepNumber === safeStep
              ? "workflowStepCurrent"
              : "workflowStepPending";

        return (
          <li
            className={className}
            key={label}
            title={label}
          >
            <span aria-hidden="true">{stepNumber}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function clampProgressStep(value, total) {
  const step = Number(value);

  if (!Number.isFinite(step)) {
    return 1;
  }

  return Math.min(Math.max(Math.round(step), 1), total);
}

function signatureProgressText(contract) {
  if (!contract?.signers?.length) {
    return contract ? "Aucune signature lancee" : "-";
  }

  const signedCount = contract.signers.filter(
    (signer) => signer.status === "SIGNE"
  ).length;

  return `${signedCount}/${contract.signers.length} signature(s)`;
}

function missingContractItems(contract) {
  if (
    !contract ||
    contract.status !== "A_COMPLETER_ETUDIANT" ||
    isContractReady(contract)
  ) {
    return [];
  }

  const requiredItems = [
    ["schoolYear", "annee scolaire"],
    ["session", "session"],
    ["codeProgram", "code programme"],
    ["functionStage", "fonction du stage"],
    ["descriptionStage", "description du stage"],
    ["hoursPerWeek", "heures par semaine"],
    ["numberOfWeeks", "nombre de semaines"],
    ["scheduleType", "type d'horaire"]
  ];

  return requiredItems
    .filter(([key]) => !contract[key])
    .map(([, label]) => label);
}

function isCorrectionStatus(status) {
  return [
    "A_REVISER",
    "DOCUMENTS_MANQUANTS"
  ].includes(status);
}

function documentTypeLabel(type) {
  const labels = {
    ATTESTATION: "Attestation",
    CAQ: "CAQ",
    PERMIS_ETUDES: "Permis d'etudes",
    ASSURANCE: "Assurance",
    PIECE_IDENTITE: "Piece d'identite",
    CV: "CV",
    AUTRE: "Autre document"
  };

  return labels[type] || type || "-";
}

function formatDocumentTypes(types) {
  if (!types?.length) {
    return "-";
  }

  return types.map(documentTypeLabel).join(", ");
}

function statusLabel(status) {
  const labels = {
    BROUILLON: "Brouillon",
    SOUMISE: "Demande soumise",
    A_REVISER: "Corrections demandees",
    DOCUMENTS_MANQUANTS: "Documents manquants",
    APPROUVEE: "Dossier approuve",
    REFUSEE: "Demande refusee",
    ANNULEE: "Retiree par l'etudiant",
    CONTRAT_EN_COURS: "Contrat en cours",
    DOSSIER_COMPLET: "Dossier complet"
  };

  return labels[status] || "Demande non creee";
}

function statusClass(status) {
  if (status === "DOSSIER_COMPLET") {
    return "statusGreen";
  }

  if (
    status === "REFUSEE" ||
    status === "A_REVISER" ||
    status === "DOCUMENTS_MANQUANTS"
  ) {
    return "statusRed";
  }

  if (
    status === "BROUILLON" ||
    status === "SOUMISE" ||
    status === "APPROUVEE" ||
    status === "CONTRAT_EN_COURS"
  ) {
    return "statusOrange";
  }

  return "statusYellow";
}

function contractStatusLabel(contract) {
  if (
    contract.status === "A_COMPLETER_ETUDIANT" &&
    isContractReady(contract)
  ) {
    return "Pret pour signature";
  }

  const labels = {
    A_COMPLETER_ETUDIANT: "Contrat a completer",
    SIGNATURE_ETUDIANT:
      "Signature etudiante requise",
    CONTRAT_MILIEU_A_DEPOSER:
      "Contrat signe par le milieu a recevoir",
    SIGNATURE_ENTREPRISE:
      "Signature Documenso du milieu",
    SIGNATURE_SUPERVISEUR:
      "En attente de l'enseignant",
    SIGNATURE_CONSEILLERE:
      "En attente de la conseillere",
    SIGNATURE_DIRECTION:
      "En attente de la direction",
    DOSSIER_COMPLET: "Signe et termine",
    REJETE: "Refuse",
    APPROUVEE: "Contrat a completer",
    CONTRAT_EN_COURS: "Contrat a completer"
  };

  return labels[contract.status] || "Contrat a completer";
}

function contractStatusClass(contract) {
  if (
    contract.status === "DOSSIER_COMPLET" ||
    contract.folderStatus === "DOSSIER_COMPLET"
  ) {
    return "statusGreen";
  }

  if (contract.status === "REJETE") {
    return "statusRed";
  }

  if (
    [
      "SIGNATURE_ENTREPRISE",
      "SIGNATURE_ETUDIANT",
      "CONTRAT_MILIEU_A_DEPOSER",
      "SIGNATURE_SUPERVISEUR",
      "SIGNATURE_CONSEILLERE",
      "SIGNATURE_DIRECTION"
    ].includes(contract.status)
  ) {
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

function formatContractSubmissionError(data = {}) {
  if (data.code === "DOCUMENSO_DOCUMENT_LIMIT") {
    return (
      data.error ||
      "La limite mensuelle de documents Documenso est atteinte. Augmentez le forfait Documenso ou attendez le prochain cycle, puis relancez l'envoi pour signature."
    );
  }

  return (
    data.error ||
    "Impossible de démarrer la signature."
  );
}

function isContractReady(contract) {
  return Boolean(
    contract.schoolYear &&
      contract.session &&
      contract.codeProgram &&
      contract.functionStage &&
      contract.descriptionStage &&
      contract.hoursPerWeek &&
      contract.numberOfWeeks &&
      contract.scheduleType
  );
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

function progressStep(status, contract) {
  if (
    contract?.status === "DOSSIER_COMPLET" ||
    contract?.folderStatus === "DOSSIER_COMPLET"
  ) {
    return 9;
  }

  if (contract?.status === "SIGNATURE_ETUDIANT") {
    return 4;
  }

  if (contract?.status === "SIGNATURE_ENTREPRISE") {
    return 5;
  }

  if (
    contract?.status === "CONTRAT_MILIEU_A_DEPOSER"
  ) {
    return 5;
  }

  if (contract?.status === "SIGNATURE_SUPERVISEUR") {
    return 6;
  }

  if (contract?.status === "SIGNATURE_CONSEILLERE") {
    return 7;
  }

  if (contract?.status === "SIGNATURE_DIRECTION") {
    return 8;
  }

  if (contract?.status === "A_COMPLETER_ETUDIANT") {
    return isContractReady(contract) ? 3 : 2;
  }

  const steps = {
    SOUMISE: 3,
    A_REVISER: 3,
    DOCUMENTS_MANQUANTS: 3,
    REFUSEE: 2,
    APPROUVEE: 6,
    CONTRAT_EN_COURS: 7,
    DOSSIER_COMPLET: 9
  };

  return steps[status] || 1;
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

  return `${phone}, numero de poste ${extension}`;
}

function formatAddress(...parts) {
  const addressParts = parts.filter((part) =>
    Boolean(part)
  );

  if (!addressParts.length) {
    return "-";
  }

  return addressParts.join(", ");
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

function formValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return String(value);
}
