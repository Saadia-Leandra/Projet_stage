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
  const [error, setError] = useState("");
  const [contractError, setContractError] =
    useState("");
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
          student={student}
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
          requests={requests}
          contracts={contracts}
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
  contracts,
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
          contracts={contracts}
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
  student,
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
            student={student}
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
  student,
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
  const [downloading, setDownloading] =
    useState("");

  useEffect(() => {
    setFormData(contractToForm(contract));
    setMessage("");
    setError("");
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
      signer.email &&
      student?.email &&
      signer.email.toLowerCase() ===
        student.email.toLowerCase() &&
      signer.status === "ENVOYE"
  );

  function updateField(name, value) {
    setFormData((current) => ({
      ...current,
      [name]: value
    }));
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
        setError(
          data.error ||
            "Impossible d'enregistrer le contrat."
        );
        return;
      }

      setMessage("Contrat enregistre.");
      await onReload();
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
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
      const saveResponse = await fetch(
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

      const saveData = await saveResponse
        .json()
        .catch(() => ({}));

      if (!saveResponse.ok) {
        setError(
          saveData.error ||
            "Impossible d'enregistrer le contrat."
        );
        return;
      }

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

      setMessage(
        "Le contrat a ete envoye pour signature."
      );
      await onReload();
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setSubmitting(false);
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

      <div className="contractInfoGrid">
        <DetailItem
          label="Etudiant"
          value={`${contract.studentFirstName || ""} ${
            contract.studentLastName || ""
          }`.trim()}
        />
        <DetailItem
          label="Milieu de stage"
          value={contract.companyName}
        />
        <DetailItem
          label="Superviseur en entreprise"
          value={contract.companySupervisorName}
        />
        <DetailItem
          label="Enseignant"
          value={`${contract.teacherFirstName || ""} ${
            contract.teacherLastName || ""
          }`.trim()}
        />
      </div>

      <div className="contractFormGrid">
        <ContractField label="Annee scolaire">
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

        <ContractField label="Session">
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

        <ContractField label="Code programme">
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

        <ContractField label="Type d'horaire">
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

        <ContractField label="Heures par semaine">
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

        <ContractField label="Nombre de semaines">
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

        <ContractField label="Fonction de stage" wide>
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

        <ContractField label="Description du stage" wide>
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
          <ContractField label="Salaire horaire">
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

      <SignatureProgress
        signers={contract.signers || []}
      />

      <div className="contractActions">
        {isEditable && (
          <button
            className="secondaryButton"
            type="button"
            disabled={saving}
            onClick={saveContract}
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        )}

        {isEditable && (
          <button
            className="primaryButton"
            type="button"
            disabled={
              submitting ||
              !contract.documensoConfigured
            }
            onClick={submitContract}
          >
            {submitting
              ? "Envoi..."
              : "Envoyer pour signature"}
          </button>
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
              : "PDF genere"}
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
              : "PDF signe"}
          </button>
        )}
      </div>
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

function contractStatusLabel(contract) {
  if (
    contract.status === "A_COMPLETER_ETUDIANT" &&
    isContractReady(contract)
  ) {
    return "Pret pour signature";
  }

  const labels = {
    A_COMPLETER_ETUDIANT: "Contrat a completer",
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
