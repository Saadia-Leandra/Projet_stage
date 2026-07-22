import { createDbPool } from "../config/db.js";
import {
  compareRequestChanges,
  createResubmissionWorkflowEvent,
  assertSameRequestOnResubmission,
  ensureRequestedDocumentsPresent,
  ensureStudentCanModifyStatus,
  listActiveUploadedDocumentTypes,
  notifySupervisorOfResubmission
} from "./stageRequestCorrectionService.js";
import { updateStudentProfileForStage } from "./studentService.js";

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
          d.statut AS status,
          d.resume_taches AS taskSummary,
          d.date_debut AS startDate,
          d.date_fin AS endDate,
          d.horaire_stage AS workSchedule,
          d.heures_semaine AS hoursPerWeek,
          d.langue_travail AS workLanguage,
          d.type_horaire AS scheduleType,
          d.nombre_semaines AS numberOfWeeks,
          d.est_remunere AS isPaid,
          d.salaire_horaire AS hourlySalary,
          d.autre_compensation AS otherCompensation,
          d.correction_documents_demandes AS correctionMissingDocuments,

          ds.superviseur_id AS supervisorId,

          student_user.prenom AS studentFirstName,
          student_user.nom AS studentLastName,
          student_user.telephone AS studentPhone,

          etu.adresse AS studentAddress,
          etu.ville AS studentCity,
          etu.province AS studentProvince,
          etu.code_postal AS studentPostalCode,
          etu.expiration_caq AS expirationCaq,
          etu.expiration_permis_etudes AS expirationStudyPermit,
          etu.expiration_assurance AS expirationInsurance,

          ent.nom AS companyName,
          ent.neq AS companyNeq,
          ent.adresse AS companyAddress,
          ent.ville AS companyCity,
          ent.province AS companyProvince,
          ent.code_postal AS companyPostalCode,
          ent.telephone AS companyPhone,
          ent.poste_telephonique AS companyPhoneExtension,
          ent.courriel AS companyEmail,
          ent.site_web AS companyWebsite,
          ent.type_organisation AS organizationType,
          ent.secteur_activite AS businessSector,
          ent.contact_rh_nom AS hrName,
          ent.contact_rh_courriel AS hrEmail,
          ent.contact_rh_telephone AS hrPhone,
          ent.contact_rh_poste AS hrExtension,
          ent.superviseur_nom AS supervisorName,
          ent.superviseur_titre AS supervisorTitle,
          ent.superviseur_courriel AS supervisorEmail,
          ent.superviseur_telephone AS supervisorPhone
        FROM demandes_stage d
        INNER JOIN dossiers_stage ds
          ON ds.id = d.dossier_stage_id
        INNER JOIN utilisateurs student_user
          ON student_user.id = ds.etudiant_id
        INNER JOIN etudiants etu
          ON etu.utilisateur_id = ds.etudiant_id
        INNER JOIN entreprises ent
          ON ent.id = d.entreprise_id
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

    ensureStudentCanModifyStatus(request.status);

    await ensureRequestedDocumentsPresent(
      connection,
      request
    );

    const changedFields = compareRequestChanges(
      request,
      requestData
    );
    const uploadedDocuments =
      await listActiveUploadedDocumentTypes(
        connection,
        request.id,
        request.folderId
      );

    await updateStudentProfileForStage(
      connection,
      studentId,
      requestData
    );

    await connection.execute(
      `
        UPDATE entreprises
        SET
          nom = ?,
          neq = ?,
          adresse = ?,
          ville = ?,
          province = ?,
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
        requestData.companyProvince,
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
          resoumis_le = NOW(),
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

    await createResubmissionWorkflowEvent(
      connection,
      {
        folderId: request.folderId,
        actorId: studentId,
        oldStatus: request.status,
        changedFields,
        uploadedDocuments
      }
    );

    assertSameRequestOnResubmission(
      request.id,
      requestId
    );

    await notifySupervisorOfResubmission(
      connection,
      {
        supervisorId: request.supervisorId,
        studentFullName: [
          request.studentFirstName,
          request.studentLastName
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),
        requestId,
        changedFields,
        uploadedDocuments
      }
    );

    await connection.commit();

    return {
      id: Number(requestId),
      folderId: request.folderId,
      ...requestData,
      status: "SOUMISE",
      refusalReason: null,
      resubmittedAt: new Date().toISOString()
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

    studentPhone: optional(data.studentPhone),
    studentAddress: optional(data.studentAddress),
    studentCity: optional(data.studentCity),
    studentProvince: clean(data.studentProvince),
    studentPostalCode: optional(
      data.studentPostalCode
    ),
    expirationCaq: optionalDate(
      data.expirationCaq,
      "La date d'expiration du CAQ"
    ),
    expirationStudyPermit: optionalDate(
      data.expirationStudyPermit,
      "La date d'expiration du permis d'etudes"
    ),
    expirationInsurance: optionalDate(
      data.expirationInsurance,
      "La date d'expiration de l'assurance"
    ),

    companyName: clean(data.companyName),
    companyNeq: optional(data.companyNeq),
    companyAddress: clean(data.companyAddress),
    companyCity: clean(data.companyCity),
    companyProvince: clean(data.companyProvince),
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
    requestData.studentPhone,
    requestData.studentAddress,
    requestData.studentCity,
    requestData.studentProvince,
    requestData.studentPostalCode,
    requestData.companyName,
    requestData.companyAddress,
    requestData.companyCity,
    requestData.companyProvince,
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

function optionalDate(value, fieldName) {
  const dateValue = optional(value);

  if (!dateValue) {
    return null;
  }

  if (!isValidDate(dateValue)) {
    throw createError(
      `${fieldName} est invalide.`,
      400
    );
  }

  return dateValue;
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
