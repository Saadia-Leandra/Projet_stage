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
import { createNotificationForUsers } from "./notificationService.js";

const db = createDbPool();

export const STUDENT_WITHDRAWABLE_REQUEST_STATUSES = [
  "BROUILLON",
  "SOUMISE"
];

export async function updateInternshipRequest(
  studentId,
  requestId,
  data
) {
  const isDraft = isDraftIntent(data);
  const requestData = validateRequestData(data, {
    draft: isDraft
  });
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
          d.resoumis_le AS resubmittedAt,

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

    if (isDraft && request.status !== "BROUILLON") {
      throw createError(
        "Seul un brouillon peut etre enregistre sans soumission.",
        409
      );
    }

    if (!isDraft) {
      await ensureRequestedDocumentsPresent(
        connection,
        request
      );
    }

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

    const nextStatus =
      isDraft && request.status === "BROUILLON"
        ? "BROUILLON"
        : "SOUMISE";

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
          statut = ?,
          motif_refus = NULL,
          resoumis_le = CASE
            WHEN ? = 'SOUMISE' THEN NOW()
            ELSE resoumis_le
          END,
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
        nextStatus,
        nextStatus,
        requestId
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = ?
        WHERE id = ?
      `,
      [
        nextStatus === "BROUILLON"
          ? "DEMANDE_NON_CREEE"
          : "DEMANDE_SOUMISE",
        request.folderId
      ]
    );

    if (nextStatus === "BROUILLON") {
      await createDraftWorkflowEvent(connection, {
        folderId: request.folderId,
        actorId: studentId,
        oldStatus: request.status,
        changedFields
      });
    } else {
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
    }

    assertSameRequestOnResubmission(
      request.id,
      requestId
    );

    if (nextStatus === "SOUMISE") {
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
    }

    await connection.commit();

    return {
      id: Number(requestId),
      folderId: request.folderId,
      ...requestData,
      status: nextStatus,
      refusalReason: null,
      resubmittedAt:
        nextStatus === "SOUMISE"
          ? new Date().toISOString()
          : request.resubmittedAt || null
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function withdrawInternshipRequest(
  studentId,
  requestId,
  reason = ""
) {
  const withdrawalReason =
    clean(reason) ||
    "Retiree par l'etudiant.";
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `
        SELECT
          d.id,
          d.dossier_stage_id AS folderId,
          d.statut AS status,
          ds.superviseur_id AS supervisorId,
          student_user.prenom AS studentFirstName,
          student_user.nom AS studentLastName,
          c.id AS contractId
        FROM demandes_stage d
        INNER JOIN dossiers_stage ds
          ON ds.id = d.dossier_stage_id
        INNER JOIN utilisateurs student_user
          ON student_user.id = ds.etudiant_id
        LEFT JOIN contrats c
          ON c.demande_stage_id = d.id
        WHERE d.id = ?
          AND ds.etudiant_id = ?
        LIMIT 1
        FOR UPDATE
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

    if (request.contractId) {
      throw createError(
        "Cette demande ne peut plus etre retiree, car elle est liee a un contrat actif.",
        409
      );
    }

    if (
      !STUDENT_WITHDRAWABLE_REQUEST_STATUSES.includes(
        request.status
      )
    ) {
      throw createError(
        "Cette demande ne peut plus etre retiree, car son traitement a deja commence.",
        409
      );
    }

    await connection.execute(
      `
        UPDATE demandes_stage
        SET
          statut = 'ANNULEE',
          retrait_motif = ?,
          retiree_par_utilisateur_id = ?,
          retiree_le = NOW()
        WHERE id = ?
      `,
      [
        withdrawalReason,
        studentId,
        request.id
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'DEMANDE_NON_CREEE'
        WHERE id = ?
      `,
      [request.folderId]
    );

    await createWorkflowEvent(connection, {
      folderId: request.folderId,
      actorId: studentId,
      eventType: "DEMANDE_RETIREE",
      oldStatus: request.status,
      newStatus: "ANNULEE",
      comment: withdrawalReason
    });

    if (
      request.status === "SOUMISE" &&
      request.supervisorId
    ) {
      await createNotificationForUsers(connection, {
        title: "Demande de stage retiree",
        message: `La demande de stage de ${[
          request.studentFirstName,
          request.studentLastName
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || "l'etudiant"} a ete retiree.`,
        type: "DEMANDE_STAGE_RETIREE",
        requestId: request.id,
        actionUrl: `/supervisor/stages/requests/${request.id}`,
        userIds: [request.supervisorId]
      });
    }

    await connection.commit();

    return {
      id: Number(requestId),
      status: "ANNULEE",
      withdrawalReason
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createWorkflowEvent(
  connection,
  {
    folderId,
    actorId,
    eventType,
    oldStatus,
    newStatus,
    comment
  }
) {
  await connection.execute(
    `
      INSERT INTO evenements_workflow (
        dossier_stage_id,
        utilisateur_acteur_id,
        type_evenement,
        ancien_statut,
        nouveau_statut,
        commentaire
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      folderId,
      actorId,
      eventType,
      oldStatus,
      newStatus,
      comment
    ]
  );
}

async function createDraftWorkflowEvent(
  connection,
  {
    folderId,
    actorId,
    oldStatus,
    changedFields
  }
) {
  await connection.execute(
    `
      INSERT INTO evenements_workflow (
        dossier_stage_id,
        utilisateur_acteur_id,
        type_evenement,
        ancien_statut,
        nouveau_statut,
        commentaire
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      folderId,
      actorId,
      "DEMANDE_BROUILLON_ENREGISTREE",
      oldStatus,
      "BROUILLON",
      JSON.stringify({
        changedFields: changedFields.map(
          (change) => change.label
        )
      })
    ]
  );
}

function validateRequestData(
  data = {},
  { draft = false } = {}
) {
  const requestData = {
    taskSummary: clean(data.taskSummary),
    startDate: draft
      ? optionalDate(data.startDate, "La date de debut")
      : clean(data.startDate),
    endDate: draft
      ? optionalDate(data.endDate, "La date de fin")
      : clean(data.endDate),

    studentPhone: optional(data.studentPhone),
    studentAddress: optional(data.studentAddress),
    studentCity: optional(data.studentCity),
    studentProvince: draft
      ? optional(data.studentProvince)
      : clean(data.studentProvince),
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

    companyName: draft
      ? clean(data.companyName) ||
        "Entreprise a confirmer"
      : clean(data.companyName),
    companyNeq: optional(data.companyNeq),
    companyAddress: draft
      ? optional(data.companyAddress)
      : clean(data.companyAddress),
    companyCity: draft
      ? optional(data.companyCity)
      : clean(data.companyCity),
    companyProvince: draft
      ? optional(data.companyProvince)
      : clean(data.companyProvince),
    companyPostalCode: draft
      ? optional(data.companyPostalCode)
      : clean(data.companyPostalCode),
    companyPhone: draft
      ? optional(data.companyPhone)
      : clean(data.companyPhone),
    companyPhoneExtension: optional(
      data.companyPhoneExtension
    ),
    companyEmail: optional(data.companyEmail),
    companyWebsite: optional(
      data.companyWebsite
    ),
    organizationType: draft
      ? optional(data.organizationType)
      : clean(data.organizationType),
    businessSector: draft
      ? optional(data.businessSector)
      : clean(data.businessSector),

    hrName: optional(data.hrName),
    hrEmail: optional(data.hrEmail),
    hrPhone: optional(data.hrPhone),
    hrExtension: optional(data.hrExtension),

    supervisorName: draft
      ? optional(data.supervisorName)
      : clean(data.supervisorName),
    supervisorTitle: draft
      ? optional(data.supervisorTitle)
      : clean(data.supervisorTitle),
    supervisorEmail: draft
      ? optional(data.supervisorEmail)
      : clean(data.supervisorEmail),
    supervisorPhone: draft
      ? optional(data.supervisorPhone)
      : clean(data.supervisorPhone),

    workSchedule: draft
      ? optional(data.workSchedule)
      : clean(data.workSchedule),
    hoursPerWeek: toPositiveNumber(
      draft && isEmpty(data.hoursPerWeek)
        ? 1
        : data.hoursPerWeek,
      "Le nombre d’heures par semaine"
    ),
    workLanguage: draft
      ? optional(data.workLanguage)
      : clean(data.workLanguage),
    scheduleType: draft
      ? optional(data.scheduleType)
      : clean(data.scheduleType),
    numberOfWeeks: toPositiveNumber(
      draft && isEmpty(data.numberOfWeeks)
        ? 1
        : data.numberOfWeeks,
      "Le nombre de semaines"
    ),
    isPaid: Boolean(data.isPaid),
    hourlySalary: null,
    otherCompensation: optional(
      data.otherCompensation
    )
  };

  if (draft) {
    if (isEmpty(data.hoursPerWeek)) {
      requestData.hoursPerWeek = null;
    }

    if (isEmpty(data.numberOfWeeks)) {
      requestData.numberOfWeeks = null;
    }

    validateOptionalDraftValues(requestData);

    if (requestData.isPaid) {
      requestData.hourlySalary =
        optionalNonNegativeNumber(
          data.hourlySalary,
          "Le salaire horaire"
        );
    }

    return requestData;
  }

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

function validateOptionalDraftValues(requestData) {
  if (
    requestData.taskSummary &&
    (
      requestData.taskSummary.length < 20 ||
      requestData.taskSummary.length > 3000
    )
  ) {
    throw createError(
      "Le resume doit contenir entre 20 et 3000 caracteres.",
      400
    );
  }

  if (
    requestData.startDate &&
    requestData.endDate &&
    requestData.endDate <= requestData.startDate
  ) {
    throw createError(
      "La date de fin doit etre apres la date de debut.",
      400
    );
  }

  if (
    requestData.hoursPerWeek &&
    requestData.hoursPerWeek > 80
  ) {
    throw createError(
      "Le nombre d'heures ne peut pas depasser 80.",
      400
    );
  }

  if (
    requestData.numberOfWeeks &&
    requestData.numberOfWeeks > 52
  ) {
    throw createError(
      "Le nombre de semaines ne peut pas depasser 52.",
      400
    );
  }

  if (
    requestData.organizationType &&
    !["PUBLIC", "PRIVE"].includes(
      requestData.organizationType
    )
  ) {
    throw createError(
      "Le type d'organisation est invalide.",
      400
    );
  }

  if (
    requestData.scheduleType &&
    ![
      "TEMPS_PLEIN",
      "TEMPS_PARTIEL"
    ].includes(requestData.scheduleType)
  ) {
    throw createError(
      "Le type d'horaire est invalide.",
      400
    );
  }

  if (
    requestData.supervisorEmail &&
    !isValidEmail(requestData.supervisorEmail)
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
      "Le courriel de l'entreprise est invalide.",
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

function optionalNonNegativeNumber(
  value,
  fieldName
) {
  if (isEmpty(value)) {
    return null;
  }

  return toNonNegativeNumber(value, fieldName);
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

function isDraftIntent(data = {}) {
  return [
    data.intent,
    data.action,
    data.status
  ].some((value) => {
    const text = String(value || "").trim();

    return (
      text.toLowerCase() === "draft" ||
      text.toUpperCase() === "BROUILLON"
    );
  });
}

function isEmpty(value) {
  return (
    value === "" ||
    value === null ||
    value === undefined
  );
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
