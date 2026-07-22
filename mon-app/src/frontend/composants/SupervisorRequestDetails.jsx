export default function SupervisorRequestDetails({
  request,
  actionLoading,
  onApprove,
  onRequestCorrections,
  onRefuse,
  onClose
}) {
  const canDecide = request.status === "SOUMISE";

  return (
    <section className="studentPanel requestDetailsPanel">
      <div className="panelHeader">
        <div>
          <h2>Détail de la demande</h2>

          <p>
            Demande #{request.id} —{" "}
            {request.studentFullName || "Étudiant"}
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
          <strong>Motif du refus definitif :</strong>{" "}
          {request.refusalReason}
        </div>
      )}

      {isCorrectionStatus(request.status) && (
        <div className="studentError">
          <strong>Correction demandee :</strong>{" "}
          {request.correctionStudentComment ||
            request.correctionReason}
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
            label="Documents demandes"
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

      <DetailsSection title="1. Étudiant">
        <DetailItem
          label="Nom complet"
          value={request.studentFullName}
        />

        <DetailItem
          label="Code étudiant"
          value={request.studentCode}
        />

        <DetailItem
          label="Code permanent"
          value={request.permanentCode}
        />

        <DetailItem
          label="Courriel"
          value={request.studentEmail}
        />

        <DetailItem
          label="Téléphone"
          value={request.studentPhone}
        />

        <DetailItem
          label="Programme"
          value={request.program}
        />

        <DetailItem
          label="Cohorte"
          value={request.cohort}
        />

        <DetailItem
          label="Groupe"
          value={request.studentGroup}
        />
      </DetailsSection>

      <DetailsSection title="2. Identification du stage">
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
          wide
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

      <DetailsSection title="3. Entreprise">
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

      <DetailsSection title="4. Responsable des ressources humaines">
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

      <DetailsSection title="5. Superviseur en entreprise">
        <DetailItem
          label="Nom"
          value={request.companySupervisorName}
        />

        <DetailItem
          label="Titre professionnel"
          value={request.companySupervisorTitle}
        />

        <DetailItem
          label="Courriel"
          value={request.companySupervisorEmail}
        />

        <DetailItem
          label="Téléphone"
          value={request.companySupervisorPhone}
        />
      </DetailsSection>

      <DetailsSection title="6. Rémunération">
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
              ? formatMoney(request.hourlySalary)
              : "-"
          }
        />

        <DetailItem
          label="Autre compensation"
          value={request.otherCompensation}
          wide
        />
      </DetailsSection>

      <DetailsSection title="7. Suivi de la demande">
        <DetailItem
          label="Créée le"
          value={formatDateTime(request.createdAt)}
        />

        <DetailItem
          label="Dernière modification"
          value={formatDateTime(request.updatedAt)}
        />

        <DetailItem
          label="Décision prise le"
          value={formatDateTime(request.decidedAt)}
        />

        <DetailItem
          label="Statut"
          value={statusLabel(request.status)}
        />
      </DetailsSection>

      <DetailsSection title="Documents de correction">
        {request.documents?.length ? (
          request.documents.map((document) => (
            <div
              className="requestDetailItem"
              key={document.id}
            >
              <strong>
                {documentTypeLabel(document.type)}
              </strong>

              <span>{document.fileName}</span>
              <small>
                Version {document.version} -{" "}
                {formatDateTime(document.uploadedAt)}
              </small>

              <button
                className="secondaryButton fitButton"
                type="button"
                onClick={() =>
                  downloadDocument(
                    request.id,
                    document.id
                  )
                }
              >
                Telecharger
              </button>
            </div>
          ))
        ) : (
          <div className="emptyState">
            Aucun document depose pour cette demande.
          </div>
        )}
      </DetailsSection>

      <DetailsSection title="Dernieres modifications">
        {request.history?.length ? (
          request.history.map((event) => (
            <div
              className="requestDetailItem requestDetailWide"
              key={event.id}
            >
              <strong>
                {workflowEventLabel(event.type)}
              </strong>

              <span>
                {statusLabel(event.oldStatus)} vers{" "}
                {statusLabel(event.newStatus)}
              </span>

              <small>
                {formatDateTime(event.createdAt)} -{" "}
                {event.actorName ||
                  roleLabel(event.actorRole)}
              </small>

              {event.comment && (
                <small>
                  {formatWorkflowComment(
                    event.comment
                  )}
                </small>
              )}
            </div>
          ))
        ) : (
          <div className="emptyState">
            Aucun historique disponible.
          </div>
        )}
      </DetailsSection>

      {canDecide && (
        <div className="supervisorDecisionActions">
          <button
            className="primaryButton"
            type="button"
            onClick={() => onApprove(request)}
            disabled={actionLoading}
          >
            {actionLoading
              ? "Traitement..."
              : "Approuver la demande"}
          </button>

          <button
            className="dangerButton"
            type="button"
            onClick={() => onRefuse(request)}
            disabled={actionLoading}
          >
            Refuser definitivement
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
            Demander des corrections
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
        </div>
      )}
    </section>
  );
}

async function downloadDocument(
  requestId,
  documentId
) {
  const token = localStorage.getItem("token");

  if (!token) {
    return;
  }

  try {
    const response = await fetch(
      `/api/supervisor/stages/requests/${requestId}/documents/${documentId}/download`,
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `document-${documentId}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
  }
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

function workflowEventLabel(type) {
  const labels = {
    DEMANDE_APPROUVEE: "Demande approuvee",
    DEMANDE_REFUSEE: "Refus definitif",
    CORRECTIONS_DEMANDEES: "Corrections demandees",
    DOCUMENTS_MANQUANTS_DEMANDES:
      "Documents manquants demandes",
    DEMANDE_RESOUMISE: "Demande resoumise",
    DOCUMENT_STAGE_AJOUTE: "Document ajoute",
    DOCUMENT_STAGE_REMPLACE: "Document remplace",
    DOCUMENT_STAGE_SUPPRIME: "Document supprime"
  };

  return labels[type] || type || "Evenement";
}

function formatWorkflowComment(comment) {
  try {
    const parsed = JSON.parse(comment);

    if (parsed.studentComment) {
      return parsed.studentComment;
    }

    if (parsed.reason) {
      return parsed.reason;
    }

    if (parsed.changedFields?.length) {
      return `Champs modifies : ${parsed.changedFields.join(", ")}`;
    }

    if (parsed.documentType) {
      return `${documentTypeLabel(parsed.documentType)} - ${parsed.fileName || ""}`;
    }
  } catch {
    return comment;
  }

  return comment;
}

function roleLabel(role) {
  const labels = {
    SUPERVISEUR: "Superviseur",
    ETUDIANT: "Etudiant",
    CONSEILLERE: "Conseillere",
    DIRECTION: "Direction"
  };

  return labels[role] || role || "-";
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
