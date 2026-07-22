import { useEffect, useMemo, useState } from "react";
import StudentRequestForm from "./StudentRequestForm.jsx";
import StudentRequestEditForm from "./StudentRequestEditForm.jsx";

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

  const latestRequest = useMemo(
    () => requests[0] || null,
    [requests]
  );

  const latestContract = useMemo(
    () => contracts[0] || null,
    [contracts]
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
          onCreated={loadDashboard}
        />
      )}

      {view === "contracts" && (
        <ContractsView
          contracts={contracts}
          requests={requests}
          onNavigate={onNavigate}
          onReload={loadDashboard}
        />
      )}

      {view === "dashboard" && (
        <OverviewView
          loading={loading}
          student={student}
          latestRequest={latestRequest}
          latestContract={latestContract}
          requests={requests}
          contracts={contracts}
          notifications={notifications}
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
  latestContract,
  requests,
  contracts,
  notifications,
  onNavigate
}) {
  const [downloadError, setDownloadError] =
    useState("");
  const [downloadingFinal, setDownloadingFinal] =
    useState(false);

  const nextAction = studentNextAction(
    latestRequest,
    latestContract
  );
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
            {progressStep(
              latestRequest?.status,
              latestContract
            )}
            /9
          </strong>
        </div>

        <div className="studentProgressTrack">
          <span
            style={{
              width: `${progressPercent(
                latestRequest?.status,
                latestContract
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
              <strong>{nextAction.title}</strong>
              <small>{nextAction.detail}</small>
            </span>
          </div>
        </div>

        {isCorrectionStatus(latestRequest?.status) && (
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
            onClick={() =>
              onNavigate(nextAction.targetView)
            }
          >
            {nextAction.buttonLabel}
          </button>

          {latestContract?.signedPdfAvailable && (
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
  contracts,
  requests,
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
  const [submitting, setSubmitting] =
    useState(false);
  const [uploadingMilieu, setUploadingMilieu] =
    useState(false);
  const [milieuFile, setMilieuFile] =
    useState(null);
  const [receipt, setReceipt] = useState(
    contract.receipt || null
  );
  const [downloading, setDownloading] =
    useState("");

  useEffect(() => {
    setFormData(contractToForm(contract));
    setMessage("");
    setError("");
    setMilieuFile(null);
    setReceipt(contract.receipt || null);
  }, [contract]);

  const isEditable =
    contract.status === "A_COMPLETER_ETUDIANT";

  const currentSigner = contract.signers?.find(
    (signer) =>
      ["ENVOYE", "EN_ATTENTE"].includes(
        signer.status
      )
  );

  const studentSigner = contract.signers?.find(
    (signer) =>
      signer.role === "ETUDIANT" &&
      signer.status === "ENVOYE"
  );

  const canDepositMilieuContract =
    contract.status === "CONTRAT_MILIEU_A_DEPOSER";

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
      setMessage("Contrat enregistre.");
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
          data.error ||
            "Impossible de demarrer la signature."
        );
        return;
      }

      await onReload();
      setMessage(
        "Le contrat est enregistre. Ouvrez Documenso pour signer votre partie."
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

  async function uploadMilieuContract() {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    if (!milieuFile) {
      setError(
        "Selectionnez le PDF signe par le milieu de stage."
      );
      return;
    }

    const confirmed = window.confirm(
      "Deposer ce contrat signe par le milieu de stage ?"
    );

    if (!confirmed) {
      return;
    }

    setUploadingMilieu(true);
    setError("");
    setMessage("");

    try {
      const body = new FormData();
      body.append("file", milieuFile);

      const response = await fetch(
        `/api/contracts/${contract.id}/milieu-signed-document`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de deposer le contrat signe."
        );
        return;
      }

      setReceipt(data.contract?.receipt || null);
      setMilieuFile(null);
      await onReload();
      setMessage(
        data.contract?.documensoWarning
          ? `Votre contrat signe a ete recu avec succes. ${data.contract.documensoWarning}`
          : "Votre contrat signe a ete recu avec succes."
      );
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setUploadingMilieu(false);
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

      {isEditable && contract.generatedPdfAvailable && (
        <p className="notice">
          PDF officiel deja genere. Les modifications
          seront appliquees au prochain export.
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
              submitting
            }
            onClick={saveContract}
          >
            {saving
              ? "Enregistrement..."
              : "Enregistrer les modifications"}
          </button>
        )}

        {isEditable && (
          <button
            className="primaryButton"
            type="button"
            disabled={
              saving ||
              submitting ||
              !contract.documensoConfigured
            }
            onClick={submitContract}
          >
            {submitting
              ? "Envoi..."
              : "Enregistrer et signer"}
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

        {canDepositMilieuContract && (
          <div className="documentUploadInline">
            <label className="field">
              Contrat signe par le milieu *
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) =>
                  setMilieuFile(
                    event.target.files?.[0] || null
                  )
                }
              />
            </label>
            <button
              className="primaryButton"
              type="button"
              disabled={
                uploadingMilieu || !milieuFile
              }
              onClick={uploadMilieuContract}
            >
              {uploadingMilieu
                ? "Depot en cours..."
                : "Deposer le contrat signe par le milieu"}
            </button>
          </div>
        )}

        {contract.generatedPdfAvailable && (
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
              : canDepositMilieuContract
                ? "Telecharger le contrat a faire signer"
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

      {(receipt || contract.confirmationCode) && (
        <div className="receiptPanel">
          <strong>
            Votre contrat signe a ete recu avec succes.
          </strong>
          <span>
            Code de confirmation :{" "}
            {receipt?.confirmationCode ||
              contract.confirmationCode}
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

function RequestsTable({
  requests,
  selectedRequest,
  onSelect,
  onEdit
}) {
  const [filter, setFilter] = useState("TOUTES");
  const filteredRequests = useMemo(() => {
    if (filter === "TOUTES") {
      return requests;
    }

    return requests.filter(
      (request) => request.status === filter
    );
  }, [filter, requests]);

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
        <h2>Mes demandes de stage</h2>

        <span className="statusPill">
          {requests.length} demande(s)
        </span>
      </div>

      <div className="tableToolbar">
        <label className="tableFilter">
          Filtrer
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
          >
            <option value="TOUTES">
              Toutes les demandes
            </option>
            <option value="SOUMISE">
              Soumises
            </option>
            <option value="A_REVISER">
              A corriger
            </option>
            <option value="DOCUMENTS_MANQUANTS">
              Documents manquants
            </option>
            <option value="APPROUVEE">
              Approuvees
            </option>
            <option value="REFUSEE">
              Refusees definitivement
            </option>
          </select>
        </label>
      </div>

      <div className="studentTableWrap">
        <table>
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Dates</th>
              <th>Statut</th>
              <th>Prochaine action</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRequests.map((request) => {
              const canEdit = [
                "SOUMISE",
                "A_REVISER",
                "DOCUMENTS_MANQUANTS"
              ].includes(request.status);
              const nextAction =
                studentRequestNextAction(request);

              return (
                <tr key={request.id}>
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
                    {formatDate(
                      request.startDate
                    )}{" "}
                    au{" "}
                    {formatDate(
                      request.endDate
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
                    <span className="nextActionText">
                      <strong>
                        {nextAction.title}
                      </strong>
                      <small>
                        {nextAction.detail}
                      </small>
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

                      <button
                        className="secondaryButton"
                        type="button"
                        onClick={() =>
                          downloadRequestPdf(request)
                        }
                      >
                        PDF demande
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!filteredRequests.length && (
              <tr>
                <td colSpan="5">
                  <div className="emptyState">
                    Aucune demande ne correspond au
                    filtre selectionne.
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
    "Signature du milieu recue",
    "Signature de l'enseignant",
    "Signature de la conseillere",
    "Signature de la direction",
    "Dossier complet"
  ];

  return (
    <ol className="workflowStepList">
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const className =
          stepNumber < currentStep
            ? "workflowStepDone"
            : stepNumber === currentStep
              ? "workflowStepCurrent"
              : "workflowStepPending";

        return (
          <li className={className} key={label}>
            <span>{stepNumber}</span>
            <strong>{label}</strong>
          </li>
        );
      })}
    </ol>
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

function studentNextAction(request, contract) {
  if (!request) {
    return {
      title: "Creer une demande",
      detail:
        "Aucune demande n'est encore associee au dossier.",
      buttonLabel: "Commencer une demande",
      targetView: "requests"
    };
  }

  if (request.status === "A_REVISER") {
    return {
      title: "Corrections requises",
      detail:
        request.correctionStudentComment ||
        "Corrigez les informations indiquees puis resoumettez.",
      buttonLabel: "Corriger ma demande",
      targetView: "requests"
    };
  }

  if (request.status === "DOCUMENTS_MANQUANTS") {
    return {
      title: "Documents manquants",
      detail:
        request.correctionStudentComment ||
        "Ajoutez ou remplacez les documents demandes.",
      buttonLabel: "Ajouter les documents manquants",
      targetView: "requests"
    };
  }

  if (request.status === "REFUSEE") {
    return {
      title: "Demande fermee",
      detail:
        request.refusalReason ||
        "Cette demande est refusee definitivement.",
      buttonLabel: "Voir le detail",
      targetView: "requests"
    };
  }

  if (
    contract?.status === "A_COMPLETER_ETUDIANT"
  ) {
    return {
      title: isContractReady(contract)
        ? "Signer le contrat"
        : "Completer le contrat",
      detail: isContractReady(contract)
        ? "Enregistrez les informations et signez votre partie."
        : "Completez les champs manquants du contrat.",
      buttonLabel: isContractReady(contract)
        ? "Enregistrer et signer"
        : "Completer le contrat",
      targetView: "contracts"
    };
  }

  if (
    contract?.status === "CONTRAT_MILIEU_A_DEPOSER"
  ) {
    return {
      title: "Contrat du milieu a deposer",
      detail:
        "Faites signer le PDF par le milieu de stage puis deposez-le ici.",
      buttonLabel:
        "Deposer le contrat signe par le milieu",
      targetView: "contracts"
    };
  }

  if (contract?.status === "SIGNATURE_ETUDIANT") {
    return {
      title: "Signature etudiante requise",
      detail:
        "Votre signature doit etre confirmee par Documenso avant la suite.",
      buttonLabel: "Signer le contrat",
      targetView: "contracts"
    };
  }

  if (isSignatureStatus(contract?.status)) {
    return {
      title: "Signatures en cours",
      detail:
        "Le dossier avance selon l'ordre de signature.",
      buttonLabel: "Voir les signatures",
      targetView: "contracts"
    };
  }

  if (
    contract?.status === "DOSSIER_COMPLET" ||
    contract?.folderStatus === "DOSSIER_COMPLET"
  ) {
    return {
      title: "Dossier complet",
      detail:
        "Le contrat final signe est disponible.",
      buttonLabel: "Voir le contrat final",
      targetView: "contracts"
    };
  }

  if (request.status === "APPROUVEE") {
    return {
      title: "Contrat a preparer",
      detail:
        "La demande est approuvee. Le contrat sera disponible ensuite.",
      buttonLabel: "Voir ma demande",
      targetView: "requests"
    };
  }

  return {
    title: "Suivi en cours",
    detail:
      "Votre demande est en attente de revision.",
    buttonLabel: "Voir mon dossier",
    targetView: "requests"
  };
}

function studentRequestNextAction(request) {
  if (request.status === "A_REVISER") {
    return {
      title: "Corriger",
      detail:
        request.correctionItems ||
        "Des informations doivent etre corrigees."
    };
  }

  if (request.status === "DOCUMENTS_MANQUANTS") {
    return {
      title: "Ajouter documents",
      detail: formatDocumentTypes(
        request.correctionMissingDocuments
      )
    };
  }

  if (request.status === "REFUSEE") {
    return {
      title: "Fermee",
      detail:
        request.refusalReason ||
        "Refus definitif."
    };
  }

  if (request.status === "APPROUVEE") {
    return {
      title: "Contrat",
      detail:
        "La demande est approuvee pour la suite."
    };
  }

  if (request.status === "ANNULEE") {
    return {
      title: "Terminee",
      detail: "Aucune action requise."
    };
  }

  return {
    title: "Attendre la revision",
    detail:
      "Le superviseur doit traiter la demande."
  };
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

function isSignatureStatus(status) {
  return [
    "SIGNATURE_ETUDIANT",
    "CONTRAT_MILIEU_A_DEPOSER",
    "SIGNATURE_ENTREPRISE",
    "SIGNATURE_SUPERVISEUR",
    "SIGNATURE_CONSEILLERE",
    "SIGNATURE_DIRECTION"
  ].includes(status);
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
    SOUMISE: "Demande soumise",
    A_REVISER: "Corrections demandees",
    DOCUMENTS_MANQUANTS: "Documents manquants",
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

  if (
    status === "A_REVISER" ||
    status === "DOCUMENTS_MANQUANTS"
  ) {
    return "statusYellow";
  }

  if (status === "CONTRAT_EN_COURS") {
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

function progressPercent(status, contract) {
  return Math.round(
    (progressStep(status, contract) / 9) * 100
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
