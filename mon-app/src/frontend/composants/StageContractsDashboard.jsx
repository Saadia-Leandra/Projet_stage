import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

export default function StageContractsDashboard({ user, navigationContext = {} }) {
  const [requests, setRequests] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [requestFilter, setRequestFilter] =
    useState("TOUTES");
  const [contractFilter, setContractFilter] =
    useState("TOUS");
  const [requestSearch, setRequestSearch] = useState("");
  const [contractSearch, setContractSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syncingId, setSyncingId] = useState(null);
  const [demoSigningEnabled, setDemoSigningEnabled] =
    useState(false);
  const [demoSigningLinks, setDemoSigningLinks] =
    useState(null);
  const [demoSigningLoading, setDemoSigningLoading] =
    useState(false);
  const [demoSigningError, setDemoSigningError] =
    useState("");
  const contractDetailsRef = useRef(null);

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

      const [requestsResponse, contractsResponse] =
        await Promise.all([
          fetch("/api/stage-management/requests", {
            headers
          }),
          fetch("/api/stage-management/contracts", {
            headers
          })
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

      setRequests(requestsData.requests || []);
      setContracts(contractsData.contracts || []);
      setDemoSigningEnabled(
        Boolean(contractsData.testMode?.demoSigning)
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
    const contractId = Number(navigationContext.contractId);
    if (Number.isInteger(contractId) && contracts.some((contract) => Number(contract.id) === contractId)) {
      openContractDetails(contractId);
    }
  }, [contracts, navigationContext.contractId, navigationContext.navigationKey]);

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
  const currentUserSigner = selectedContract
    ? findCurrentUserSigner(selectedContract, user)
    : null;

  useEffect(() => {
    if (!demoSigningEnabled || !selectedContract?.id) {
      setDemoSigningLinks(null);
      setDemoSigningError("");
      return;
    }

    loadDemoSigningLinks(selectedContract.id);
  }, [demoSigningEnabled, selectedContract?.id]);

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
    const search = requestSearch.trim().toLocaleLowerCase("fr-CA");
    return requests.filter((request) =>
      (requestFilter === "TOUTES" || request.status === requestFilter)
      && (!search || [request.studentName, request.studentCode, request.companyName, request.companyCity].filter(Boolean).join(" ").toLocaleLowerCase("fr-CA").includes(search))
    );
  }, [requests, requestFilter, requestSearch]);

  const filteredContracts = useMemo(() => {
    const search = contractSearch.trim().toLocaleLowerCase("fr-CA");
    return contracts.filter((contract) => {
      const statusMatches = contractFilter === "TOUS" || (contractFilter === "SIGNATURE" ? isSignatureStatus(contract.status) : contract.status === contractFilter);
      const identity = [contract.studentName, contract.studentCode, contract.companyName, contract.teacherName].filter(Boolean).join(" ").toLocaleLowerCase("fr-CA");
      return statusMatches && (!search || identity.includes(search));
    });
  }, [contracts, contractFilter, contractSearch]);

  function openContractDetails(contractId) {
    setSelectedId(contractId);
    window.requestAnimationFrame(() => {
      contractDetailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }

  function openSigningUrl(signingUrl) {
    window.open(
      signingUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function syncDocumensoStatus(contractId) {
    const token = localStorage.getItem("token");

    if (!token) {
      setError("Session expiree.");
      return;
    }

    setSyncingId(contractId);
    setError("");

    try {
      const response = await fetch(
        `/api/stage-management/contracts/${contractId}/sync-documenso`,
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

      await loadData();
      setSelectedId(contractId);
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setSyncingId(null);
    }
  }

  async function loadDemoSigningLinks(contractId) {
    const token = localStorage.getItem("token");

    if (!token) {
      setDemoSigningLinks(null);
      return;
    }

    setDemoSigningLoading(true);
    setDemoSigningError("");
    setDemoSigningLinks(null);

    try {
      const response = await fetch(
        `/api/stage-management/contracts/${contractId}/demo-signing-links`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (response.status === 403 || response.status === 404) {
        setDemoSigningEnabled(false);
        setDemoSigningLinks(null);
        return;
      }

      if (!response.ok) {
        setDemoSigningLinks(null);
        setDemoSigningError(
          data.error ||
            "Impossible de charger le mode demonstration."
        );
        return;
      }

      setDemoSigningLinks({
        testMode: Boolean(data.testMode),
        signers: data.signers || []
      });
    } catch (requestError) {
      console.error(requestError);
      setDemoSigningLinks(null);
      setDemoSigningError(
        "Erreur de connexion au serveur."
      );
    } finally {
      setDemoSigningLoading(false);
    }
  }

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
            <p>Suivi des demandes reçues.</p>
          </div>

          <span className="statusPill">
            {loading
              ? "Chargement"
              : `${requests.length} demande(s)`}
          </span>
        </div>

        <div className="tableToolbar">
          <label className="tableFilter tableSearch">Rechercher<input value={requestSearch} onChange={(event) => setRequestSearch(event.target.value)} placeholder="Étudiant, dossier ou entreprise" /></label>
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
          <label className="tableFilter tableSearch">Rechercher<input value={contractSearch} onChange={(event) => setContractSearch(event.target.value)} placeholder="Étudiant, entreprise ou enseignant" /></label>
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
              <option value="SIGNATURE_ENTREPRISE">
                Signature milieu
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
                const currentSignerForContract =
                  findCurrentUserSigner(contract, user);

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
                      <div className="tableActions">
                        <button
                          className="secondaryButton"
                          type="button"
                          onClick={() =>
                            openContractDetails(contract.id)
                          }
                        >
                          Voir le suivi
                        </button>

                        {canCurrentUserSign(
                          currentSignerForContract,
                          user
                        ) && (
                          <button
                            className="primaryButton"
                            type="button"
                            onClick={() =>
                              openSigningUrl(
                                currentSignerForContract.signingUrl
                              )
                            }
                          >
                            Signer
                          </button>
                        )}

                        {canSyncDocumensoContract(contract) && (
                          <button
                            className="secondaryButton"
                            type="button"
                            disabled={syncingId === contract.id}
                            onClick={() =>
                              syncDocumensoStatus(contract.id)
                            }
                          >
                            {syncingId === contract.id
                              ? "Actualisation..."
                              : "Actualiser"}
                          </button>
                        )}
                      </div>
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
        <section
          className="studentPanel"
          ref={contractDetailsRef}
        >
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

          {canCurrentUserSign(currentUserSigner, user) && (
            <div className="studentSuccess">
              <span>
                Votre signature est demandee pour ce contrat.
              </span>
              <button
                className="primaryButton fitButton"
                type="button"
                onClick={() =>
                  openSigningUrl(currentUserSigner.signingUrl)
                }
              >
                Signer avec Documenso
              </button>
            </div>
          )}

          {canSyncDocumensoContract(selectedContract) && (
            <div className="studentSuccess">
              <span>
                Actualisez Documenso apres une signature si
                le statut ne change pas automatiquement.
              </span>
              <button
                className="secondaryButton fitButton"
                type="button"
                disabled={syncingId === selectedContract.id}
                onClick={() =>
                  syncDocumensoStatus(selectedContract.id)
                }
              >
                {syncingId === selectedContract.id
                  ? "Actualisation..."
                  : "Actualiser Documenso"}
              </button>
            </div>
          )}

          {demoSigningLinks?.testMode && (
            <div className="contractSection">
              <div className="nextActionText">
                <strong>Mode demonstration</strong>
                <span>
                  Ouvrir une vraie session Documenso pour
                  un signataire de ce contrat.
                </span>
              </div>

              {demoSigningLoading && (
                <p className="notice">
                  Chargement des liens de signature...
                </p>
              )}

              {demoSigningError && (
                <p className="studentError">
                  {demoSigningError}
                </p>
              )}

              <div className="contractSignerList">
                {demoSigningLinks.signers.map((signer) => (
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

                    <button
                      className="secondaryButton fitButton"
                      type="button"
                      disabled={!signer.signingUrl}
                      onClick={() =>
                        openSigningUrl(signer.signingUrl)
                      }
                    >
                      Ouvrir la signature
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  {canCurrentUserSign(signer, user) && (
                    <button
                      className="proofLinkButton"
                      type="button"
                      onClick={() =>
                        openSigningUrl(signer.signingUrl)
                      }
                    >
                      Signer avec Documenso
                    </button>
                  )}
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

          {currentUserSigner?.status === "ENVOYE" &&
            !currentUserSigner.signingUrl && (
              <p className="notice">
                Documenso a envoye le lien de signature par courriel.
                Si le compte utilise un courriel fictif, remplacez-le
                par un courriel accessible ou relancez l'envoi.
              </p>
            )}
        </section>
      )}

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

  if (
    contract.status === "CONTRAT_MILIEU_A_DEPOSER" ||
    contract.status === "SIGNATURE_ENTREPRISE"
  ) {
    return {
      title: "Milieu de stage",
      detail:
        contract.status === "SIGNATURE_ENTREPRISE"
          ? "Attendre la signature Documenso du milieu."
          : "Attendre le PDF signe par le milieu."
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

function findCurrentUserSigner(contract, user) {
  return (contract.signers || []).find((signer) =>
    isSignerForUser(signer, user)
  );
}

function canCurrentUserSign(signer, user) {
  return Boolean(
    signer?.status === "ENVOYE" &&
      signer.signingUrl &&
      isSignerForUser(signer, user)
  );
}

function canSyncDocumensoContract(contract) {
  return Boolean(
    contract?.documensoDocumentId &&
      String(contract.status || "").startsWith(
        "SIGNATURE_"
      )
  );
}

function isSignerForUser(signer, user) {
  return Boolean(
    signer &&
      user &&
      signer.role === signerRoleForUser(user.role) &&
      (
        sameUserId(signer.userId, user.id) ||
        sameEmail(signer.email, user.email)
      )
  );
}

function signerRoleForUser(role) {
  const roles = {
    SUPERVISEUR: "SUPERVISEUR",
    CONSEILLERE: "CONSEILLERE",
    DIRECTION: "DIRECTION"
  };

  return roles[role] || "";
}

function sameEmail(left, right) {
  return String(left || "").toLowerCase() ===
    String(right || "").toLowerCase();
}

function sameUserId(left, right) {
  return Boolean(left && right && Number(left) === Number(right));
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
      "Contrat du milieu a recevoir",
    SIGNATURE_ENTREPRISE:
      "Signature Documenso du milieu",
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
