import { createDbPool } from "../config/db.js";

const db = createDbPool();

export async function updateInternshipRequest(
  studentId,
  requestId,
  data
) {
  const requestData = validateRequestData(data);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          d.id,
          d.entreprise_id AS companyId,
          d.dossier_stage_id AS folderId,
          d.statut AS status
        FROM demandes_stage d
        INNER JOIN dossiers_stage ds
          ON ds.id = d.dossier_stage_id
        WHERE d.id = ?
          AND ds.etudiant_id = ?
        LIMIT 1
      `,
      [requestId, studentId]
    );

    const request = rows[0];

    if (!request) {
      throw createError(
        "Demande de stage introuvable.",
        404
      );
    }

    if (
      !["SOUMISE", "REFUSEE"].includes(
        request.status
      )
    ) {
      throw createError(
        "Cette demande ne peut plus être modifiée.",
        403
      );
    }

    await connection.execute(
      `
        UPDATE entreprises
        SET
          nom = ?,
          neq = ?,
          adresse = ?,
          ville = ?,
          code_postal = ?,
          telephone = ?,
          poste_telephonique = ?,
          courriel = ?,
          site_web = ?,
          contact_rh_nom = ?,
          contact_rh_courriel = ?,
          contact_rh_telephone = ?,
          contact_rh_poste = ?,
          superviseur_nom = ?,
          superviseur_titre = ?,
          superviseur_courriel = ?,
          superviseur_telephone = ?,
          horaire_travail = ?,
          heures_semaine = ?,
          langue_travail = ?,
          type_organisation = ?,
          secteur_activite = ?
        WHERE id = ?
      `,
      [
        requestData.companyName,
        requestData.companyNeq,
        requestData.companyAddress,
        requestData.companyCity,
        requestData.companyPostalCode,
        requestData.companyPhone,
        requestData.companyPhoneExtension,
        requestData.companyEmail,
        requestData.companyWebsite,
        requestData.hrName,
        requestData.hrEmail,
        requestData.hrPhone,
        requestData.hrExtension,
        requestData.supervisorName,
        requestData.supervisorTitle,
        requestData.supervisorEmail,
        requestData.supervisorPhone,
        requestData.workSchedule,
        requestData.hoursPerWeek,
        requestData.workLanguage,
        requestData.organizationType,
        requestData.businessSector,
        request.companyId
      ]
    );

    await connection.execute(
      `
        UPDATE demandes_stage
        SET
          resume_taches = ?,
          date_debut = ?,
          date_fin = ?,
          date_debut_disponibilite = ?,
          date_fin_disponibilite = ?,
          horaire_stage = ?,
          heures_semaine = ?,
          langue_travail = ?,
          type_horaire = ?,
          nombre_semaines = ?,
          est_remunere = ?,
          salaire_horaire = ?,
          autre_compensation = ?,
          statut = 'SOUMISE',
          motif_refus = NULL,
          decide_par_utilisateur_id = NULL,
          decide_le = NULL
        WHERE id = ?
      `,
      [
        requestData.taskSummary,
        requestData.startDate,
        requestData.endDate,
        requestData.startDate,
        requestData.endDate,
        requestData.workSchedule,
        requestData.hoursPerWeek,
        requestData.workLanguage,
        requestData.scheduleType,
        requestData.numberOfWeeks,
        requestData.isPaid,
        requestData.hourlySalary,
        requestData.otherCompensation,
        requestId
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'DEMANDE_SOUMISE'
        WHERE id = ?
      `,
      [request.folderId]
    );

    await connection.commit();

    return {
      id: Number(requestId),
      ...requestData,
      status: "SOUMISE",
      refusalReason: null
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function validateRequestData(data = {}) {
  const requestData = {
    taskSummary: clean(data.taskSummary),
    startDate: clean(data.startDate),
    endDate: clean(data.endDate),

    companyName: clean(data.companyName),
    companyNeq: optional(data.companyNeq),
    companyAddress: clean(data.companyAddress),
    companyCity: clean(data.companyCity),
    companyPostalCode: clean(
      data.companyPostalCode
    ),
    companyPhone: clean(data.companyPhone),
    companyPhoneExtension: optional(
      data.companyPhoneExtension
    ),
    companyEmail: optional(data.companyEmail),
    companyWebsite: optional(
      data.companyWebsite
    ),
    organizationType: clean(
      data.organizationType
    ),
    businessSector: clean(
      data.businessSector
    ),

    hrName: optional(data.hrName),
    hrEmail: optional(data.hrEmail),
    hrPhone: optional(data.hrPhone),
    hrExtension: optional(data.hrExtension),

    supervisorName: clean(
      data.supervisorName
    ),
    supervisorTitle: clean(
      data.supervisorTitle
    ),
    supervisorEmail: clean(
      data.supervisorEmail
    ),
    supervisorPhone: clean(
      data.supervisorPhone
    ),

    workSchedule: clean(data.workSchedule),
    hoursPerWeek: toPositiveNumber(
      data.hoursPerWeek,
      "Le nombre d’heures par semaine"
    ),
    workLanguage: clean(data.workLanguage),
    scheduleType: clean(data.scheduleType),
    numberOfWeeks: toPositiveNumber(
      data.numberOfWeeks,
      "Le nombre de semaines"
    ),
    isPaid: Boolean(data.isPaid),
    hourlySalary: null,
    otherCompensation: optional(
      data.otherCompensation
    )
  };

  const requiredFields = [
    requestData.taskSummary,
    requestData.startDate,
    requestData.endDate,
    requestData.companyName,
    requestData.companyAddress,
    requestData.companyCity,
    requestData.companyPostalCode,
    requestData.companyPhone,
    requestData.businessSector,
    requestData.supervisorName,
    requestData.supervisorTitle,
    requestData.supervisorEmail,
    requestData.supervisorPhone,
    requestData.workSchedule,
    requestData.workLanguage
  ];

  if (requiredFields.some((value) => !value)) {
    throw createError(
      "Tous les champs obligatoires doivent être remplis.",
      400
    );
  }

  if (
    requestData.taskSummary.length < 20 ||
    requestData.taskSummary.length > 3000
  ) {
    throw createError(
      "Le résumé doit contenir entre 20 et 3000 caractères.",
      400
    );
  }

  if (
    !isValidDate(requestData.startDate) ||
    !isValidDate(requestData.endDate)
  ) {
    throw createError(
      "Les dates sont invalides.",
      400
    );
  }

  if (
    requestData.endDate <=
    requestData.startDate
  ) {
    throw createError(
      "La date de fin doit être après la date de début.",
      400
    );
  }

  if (requestData.hoursPerWeek > 80) {
    throw createError(
      "Le nombre d’heures ne peut pas dépasser 80.",
      400
    );
  }

  if (requestData.numberOfWeeks > 52) {
    throw createError(
      "Le nombre de semaines ne peut pas dépasser 52.",
      400
    );
  }

  if (
    !["PUBLIC", "PRIVE"].includes(
      requestData.organizationType
    )
  ) {
    throw createError(
      "Le type d’organisation est invalide.",
      400
    );
  }

  if (
    ![
      "TEMPS_PLEIN",
      "TEMPS_PARTIEL"
    ].includes(requestData.scheduleType)
  ) {
    throw createError(
      "Le type d’horaire est invalide.",
      400
    );
  }

  if (
    !isValidEmail(
      requestData.supervisorEmail
    )
  ) {
    throw createError(
      "Le courriel du superviseur est invalide.",
      400
    );
  }

  if (
    requestData.companyEmail &&
    !isValidEmail(requestData.companyEmail)
  ) {
    throw createError(
      "Le courriel de l’entreprise est invalide.",
      400
    );
  }

  if (
    requestData.hrEmail &&
    !isValidEmail(requestData.hrEmail)
  ) {
    throw createError(
      "Le courriel du responsable RH est invalide.",
      400
    );
  }

  if (requestData.isPaid) {
    requestData.hourlySalary =
      toNonNegativeNumber(
        data.hourlySalary,
        "Le salaire horaire"
      );
  }

  return requestData;
}

function clean(value) {
  return String(value ?? "").trim();
}

function optional(value) {
  const cleanedValue = clean(value);
  return cleanedValue || null;
}

function toPositiveNumber(value, fieldName) {
  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    throw createError(
      `${fieldName} doit être supérieur à zéro.`,
      400
    );
  }

  return numberValue;
}

function toNonNegativeNumber(
  value,
  fieldName
) {
  const numberValue = Number(value);

  if (
    value === "" ||
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    throw createError(
      `${fieldName} est invalide.`,
      400
    );
  }

  return numberValue;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime());
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}