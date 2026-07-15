export default function SupervisorRequestDetails({
  request,
  actionLoading,
  onApprove,
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
          <strong>Motif du refus :</strong>{" "}
          {request.refusalReason}
        </div>
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
            Refuser la demande
          </button>
        </div>
      )}
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
