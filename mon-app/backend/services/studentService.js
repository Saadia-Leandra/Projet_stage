import { createDbPool } from "../config/db.js";
import { generateInternshipRequestPdf } from "./contractPdfService.js";
import { createNotificationForUsers } from "./notificationService.js";
import { parseDocumentList } from "./stageRequestCorrectionService.js";

const db = createDbPool();

export const ACTIVE_STAGE_REQUEST_STATUSES = [
  "BROUILLON",
  "SOUMISE",
  "A_REVISER",
  "DOCUMENTS_MANQUANTS",
  "APPROUVEE"
];

export const ACTIVE_STAGE_FOLDER_STATUSES = [
  "DEMANDE_SOUMISE",
  "CONTRAT_EN_COURS",
  "ATTENTE_SIGNATURE",
  "DOCUMENT_INCOMPLET"
];

const activeRequestMessage =
  "Vous avez deja une demande de stage active. Vous devez terminer, corriger ou retirer cette demande avant d'en creer une nouvelle.";

export async function getStudentDashboard(studentId) {
  const student = await getStudentProfile(studentId);
  const requests = await getStudentRequests(studentId);

  return {
    student,
    requests
  };
}

export async function getStudentRequests(studentId) {
  const [rows] = await db.execute(
    `
      SELECT
        ds.id AS folderId,
        ds.statut AS folderStatus,

        d.id,
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
        d.statut AS status,
        d.motif_refus AS refusalReason,
        d.correction_raison AS correctionReason,
        d.correction_elements AS correctionItems,
        d.correction_documents_demandes AS correctionMissingDocuments,
        d.correction_commentaire_etudiant AS correctionStudentComment,
        d.correction_demandee_le AS correctionRequestedAt,
        d.resoumis_le AS resubmittedAt,
        d.retrait_motif AS withdrawalReason,
        d.retiree_par_utilisateur_id AS withdrawnByUserId,
        d.retiree_le AS withdrawnAt,
        d.cree_le AS createdAt,
        d.modifie_le AS updatedAt,

        correction_user.prenom AS correctionRequestedByFirstName,
        correction_user.nom AS correctionRequestedByLastName,
        correction_user.role AS correctionRequestedByRole,

        student_user.telephone AS studentPhone,
        etu.adresse AS studentAddress,
        etu.ville AS studentCity,
        etu.province AS studentProvince,
        etu.code_postal AS studentPostalCode,
        etu.expiration_caq AS expirationCaq,
        etu.expiration_permis_etudes AS expirationStudyPermit,
        etu.expiration_assurance AS expirationInsurance,

        ent.id AS companyId,
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

      FROM dossiers_stage ds

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      INNER JOIN demandes_stage d
        ON d.dossier_stage_id = ds.id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs correction_user
        ON correction_user.id =
          d.correction_demandee_par_utilisateur_id

      WHERE ds.etudiant_id = ?

      ORDER BY d.cree_le DESC
    `,
    [studentId]
  );

  return rows.map(formatStudentRequest);
}

export async function createInternshipRequest(
  studentId,
  data
) {
  const isDraft = isDraftIntent(data);
  const requestData = validateRequestData(data, {
    draft: isDraft
  });
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const student = await getStudentProfile(
      studentId,
      connection
    );

    await lockStudentStageRequestCreation(
      connection,
      studentId
    );

    await ensureNoActiveStageRequest(
      connection,
      studentId
    );

    await updateStudentProfileForStage(
      connection,
      studentId,
      requestData
    );

    const companyId = await createCompany(
      connection,
      requestData
    );

    const folderId = await createStageFolder(
      connection,
      student
    );

    const [result] = await connection.execute(
      `
        INSERT INTO demandes_stage (
          dossier_stage_id,
          entreprise_id,
          resume_taches,
          date_debut,
          date_fin,
          date_debut_disponibilite,
          date_fin_disponibilite,
          horaire_stage,
          heures_semaine,
          langue_travail,
          type_horaire,
          nombre_semaines,
          est_remunere,
          salaire_horaire,
          autre_compensation,
          statut
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `,
      [
        folderId,
        companyId,
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
        isDraft ? "BROUILLON" : "SOUMISE"
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = ?
        WHERE id = ?
      `,
      [
        isDraft
          ? "DEMANDE_NON_CREEE"
          : "DEMANDE_SOUMISE",
        folderId
      ]
    );

    await createWorkflowEvent(connection, {
      folderId,
      actorId: studentId,
      eventType: isDraft
        ? "DEMANDE_BROUILLON_ENREGISTREE"
        : "DEMANDE_SOUMISE",
      oldStatus: "DEMANDE_NON_CREEE",
      newStatus: isDraft ? "BROUILLON" : "SOUMISE",
      comment: isDraft
        ? "La demande de stage a ete enregistree en brouillon."
        : "La demande de stage a ete soumise par l'etudiant."
    });

    if (!isDraft) {
      await createNotificationForUsers(connection, {
        title: "Demande de stage a traiter",
        message: `La demande de stage de ${[
          student.firstName,
          student.lastName
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || "l'etudiant"} a ete soumise.`,
        type: "DEMANDE_STAGE_SOUMISE",
        requestId: result.insertId,
        actionUrl: `/supervisor/stages/requests/${result.insertId}`,
        userIds: [student.supervisorId]
      });
    }

    await connection.commit();

    return {
      id: result.insertId,
      folderId,
      companyId,
      ...requestData,
      status: isDraft ? "BROUILLON" : "SOUMISE"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getStudentRequestFile(
  studentId,
  requestId
) {
  const request = await findStudentRequestForPdf(
    studentId,
    requestId
  );
  const blockedStatuses = [
    "BROUILLON",
    "A_REVISER",
    "DOCUMENTS_MANQUANTS",
    "REFUSEE",
    "ANNULEE"
  ];

  if (blockedStatuses.includes(request.status)) {
    throw createError(
      "Le PDF officiel est disponible seulement pour une demande soumise ou approuvee.",
      409
    );
  }

  return generateInternshipRequestPdf(request);
}

export async function updateStudentProfileForStage(
  connection,
  studentId,
  data
) {
  await connection.execute(
    `
      UPDATE utilisateurs
      SET telephone = COALESCE(?, telephone)
      WHERE id = ?
    `,
    [data.studentPhone, studentId]
  );

  await connection.execute(
    `
      UPDATE etudiants
      SET
        adresse = COALESCE(?, adresse),
        ville = COALESCE(?, ville),
        province = COALESCE(?, province),
        code_postal = COALESCE(?, code_postal),
        expiration_caq = COALESCE(?, expiration_caq),
        expiration_permis_etudes = COALESCE(?, expiration_permis_etudes),
        expiration_assurance = COALESCE(?, expiration_assurance)
      WHERE utilisateur_id = ?
    `,
    [
      data.studentAddress,
      data.studentCity,
      data.studentProvince,
      data.studentPostalCode,
      data.expirationCaq,
      data.expirationStudyPermit,
      data.expirationInsurance,
      studentId
    ]
  );
}

async function getStudentProfile(
  studentId,
  connection = db
) {
  const [studentRows] = await connection.execute(
    `
      SELECT
        u.id,
        u.courriel AS email,
        u.prenom AS firstName,
        u.nom AS lastName,
        u.telephone AS phone,
        e.code_permanent AS codePermanent,
        e.code_etudiant AS studentCode,
        e.programme,
        e.groupe,
        e.adresse AS address,
        e.ville AS city,
        e.province AS province,
        e.code_postal AS postalCode,
        e.expiration_caq AS expirationCaq,
        e.expiration_permis_etudes AS expirationStudyPermit,
        e.expiration_assurance AS expirationInsurance,
        e.superviseur_id AS supervisorId

      FROM utilisateurs u

      INNER JOIN etudiants e
        ON e.utilisateur_id = u.id

      WHERE u.id = ?
    `,
    [studentId]
  );

  const student = studentRows[0];

  if (!student) {
    throw createError(
      "Étudiant introuvable.",
      404
    );
  }

  return student;
}

async function findStudentRequestForPdf(
  studentId,
  requestId
) {
  const [rows] = await db.execute(
    `
      SELECT
        d.id,
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
        d.statut AS status,

        student_user.prenom AS studentFirstName,
        student_user.nom AS studentLastName,
        student_user.courriel AS studentEmail,
        student_user.telephone AS studentPhone,
        etu.code_etudiant AS studentCode,
        etu.code_permanent AS studentPermanentCode,
        etu.programme AS program,
        etu.groupe AS studentGroup,
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
        ON etu.utilisateur_id = student_user.id

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

  return {
    ...request,
    isPaid: Boolean(request.isPaid)
  };
}

async function createCompany(
  connection,
  data
) {
  const companyCode = makeCompanyCode(
    data.companyName
  );

  const [result] = await connection.execute(
    `
      INSERT INTO entreprises (
        code,
        nom,
        neq,
        adresse,
        ville,
        province,
        code_postal,
        telephone,
        poste_telephonique,
        courriel,
        site_web,
        contact_rh_nom,
        contact_rh_courriel,
        contact_rh_telephone,
        contact_rh_poste,
        superviseur_nom,
        superviseur_titre,
        superviseur_courriel,
        superviseur_telephone,
        horaire_travail,
        heures_semaine,
        langue_travail,
        type_organisation,
        secteur_activite
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )

      ON DUPLICATE KEY UPDATE
        nom = VALUES(nom),
        neq = VALUES(neq),
        adresse = VALUES(adresse),
        ville = VALUES(ville),
        province = VALUES(province),
        code_postal = VALUES(code_postal),
        telephone = VALUES(telephone),
        poste_telephonique =
          VALUES(poste_telephonique),
        courriel = VALUES(courriel),
        site_web = VALUES(site_web),
        contact_rh_nom =
          VALUES(contact_rh_nom),
        contact_rh_courriel =
          VALUES(contact_rh_courriel),
        contact_rh_telephone =
          VALUES(contact_rh_telephone),
        contact_rh_poste =
          VALUES(contact_rh_poste),
        superviseur_nom =
          VALUES(superviseur_nom),
        superviseur_titre =
          VALUES(superviseur_titre),
        superviseur_courriel =
          VALUES(superviseur_courriel),
        superviseur_telephone =
          VALUES(superviseur_telephone),
        horaire_travail =
          VALUES(horaire_travail),
        heures_semaine =
          VALUES(heures_semaine),
        langue_travail =
          VALUES(langue_travail),
        type_organisation =
          VALUES(type_organisation),
        secteur_activite =
          VALUES(secteur_activite),
        id = LAST_INSERT_ID(id)
    `,
    [
      companyCode,
      data.companyName,
      data.companyNeq,
      data.companyAddress,
      data.companyCity,
      data.companyProvince,
      data.companyPostalCode,
      data.companyPhone,
      data.companyPhoneExtension,
      data.companyEmail,
      data.companyWebsite,
      data.hrName,
      data.hrEmail,
      data.hrPhone,
      data.hrExtension,
      data.supervisorName,
      data.supervisorTitle,
      data.supervisorEmail,
      data.supervisorPhone,
      data.workSchedule,
      data.hoursPerWeek,
      data.workLanguage,
      data.organizationType,
      data.businessSector
    ]
  );

  return result.insertId;
}

async function createStageFolder(
  connection,
  student
) {
  const [result] = await connection.execute(
    `
      INSERT INTO dossiers_stage (
        etudiant_id,
        superviseur_id,
        statut
      )
      VALUES (?, ?, 'DEMANDE_SOUMISE')
    `,
    [
      student.id,
      student.supervisorId
    ]
  );

  return result.insertId;
}

async function lockStudentStageRequestCreation(
  connection,
  studentId
) {
  const [rows] = await connection.execute(
    `
      SELECT utilisateur_id
      FROM etudiants
      WHERE utilisateur_id = ?
      FOR UPDATE
    `,
    [studentId]
  );

  if (!rows[0]) {
    throw createError(
      "Etudiant introuvable.",
      404
    );
  }
}

async function ensureNoActiveStageRequest(
  connection,
  studentId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        ds.id AS folderId,
        ds.statut AS folderStatus,
        d.id AS requestId,
        d.statut AS requestStatus
      FROM dossiers_stage ds
      LEFT JOIN demandes_stage d
        ON d.dossier_stage_id = ds.id
      WHERE ds.etudiant_id = ?
        AND (
          ds.statut IN (${ACTIVE_STAGE_FOLDER_STATUSES.map(
            () => "?"
          ).join(", ")})
          OR d.statut IN (${ACTIVE_STAGE_REQUEST_STATUSES.map(
            () => "?"
          ).join(", ")})
        )
      LIMIT 1
    `,
    [
      studentId,
      ...ACTIVE_STAGE_FOLDER_STATUSES,
      ...ACTIVE_STAGE_REQUEST_STATUSES
    ]
  );

  if (rows[0]) {
    throw createError(activeRequestMessage, 409);
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

export function isActiveStageRequestStatus(status) {
  return ACTIVE_STAGE_REQUEST_STATUSES.includes(status);
}

export function isActiveStageFolderStatus(status) {
  return ACTIVE_STAGE_FOLDER_STATUSES.includes(status);
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
    ["Le résumé des tâches", requestData.taskSummary],
    [
      "Le telephone de l'etudiant",
      requestData.studentPhone
    ],
    [
      "L'adresse de l'etudiant",
      requestData.studentAddress
    ],
    ["La ville de l'etudiant", requestData.studentCity],
    [
      "La province de l'etudiant",
      requestData.studentProvince
    ],
    [
      "Le code postal de l'etudiant",
      requestData.studentPostalCode
    ],
    ["Le nom de l’entreprise", requestData.companyName],
    ["L’adresse", requestData.companyAddress],
    ["La ville", requestData.companyCity],
    ["La province", requestData.companyProvince],
    [
      "Le code postal",
      requestData.companyPostalCode
    ],
    [
      "Le téléphone de l’entreprise",
      requestData.companyPhone
    ],
    [
      "Le secteur d’activité",
      requestData.businessSector
    ],
    [
      "Le nom du superviseur",
      requestData.supervisorName
    ],
    [
      "Le titre du superviseur",
      requestData.supervisorTitle
    ],
    [
      "Le courriel du superviseur",
      requestData.supervisorEmail
    ],
    [
      "Le téléphone du superviseur",
      requestData.supervisorPhone
    ],
    [
      "L’horaire de travail",
      requestData.workSchedule
    ],
    [
      "La langue de travail",
      requestData.workLanguage
    ],
    ["La date de début", requestData.startDate],
    ["La date de fin", requestData.endDate]
  ];

  for (const [fieldName, value] of requiredFields) {
    if (!value) {
      throw createError(
        `${fieldName} est obligatoire.`,
        400
      );
    }
  }

  if (
    requestData.taskSummary.length < 20 ||
    requestData.taskSummary.length > 3000
  ) {
    throw createError(
      "Le résumé des tâches doit contenir entre 20 et 3000 caractères.",
      400
    );
  }

  if (
    !isValidDate(requestData.startDate) ||
    !isValidDate(requestData.endDate)
  ) {
    throw createError(
      "Les dates du stage sont invalides.",
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

  if (
    requestData.hoursPerWeek > 80
  ) {
    throw createError(
      "Le nombre d’heures par semaine ne peut pas dépasser 80.",
      400
    );
  }

  if (
    requestData.numberOfWeeks > 52
  ) {
    throw createError(
      "Le nombre de semaines ne peut pas dépasser 52.",
      400
    );
  }

  const allowedOrganizationTypes = [
    "PUBLIC",
    "PRIVE"
  ];

  if (
    !allowedOrganizationTypes.includes(
      requestData.organizationType
    )
  ) {
    throw createError(
      "Le type d’organisation est invalide.",
      400
    );
  }

  const allowedScheduleTypes = [
    "TEMPS_PLEIN",
    "TEMPS_PARTIEL"
  ];

  if (
    !allowedScheduleTypes.includes(
      requestData.scheduleType
    )
  ) {
    throw createError(
      "Le type d’horaire est invalide.",
      400
    );
  }

  if (
    !isValidEmail(requestData.supervisorEmail)
  ) {
    throw createError(
      "Le courriel du superviseur est invalide.",
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

  if (
    requestData.companyEmail &&
    !isValidEmail(requestData.companyEmail)
  ) {
    throw createError(
      "Le courriel de l’entreprise est invalide.",
      400
    );
  }

  if (requestData.isPaid) {
    requestData.hourlySalary = toNonNegativeNumber(
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
      "Le resume des taches doit contenir entre 20 et 3000 caracteres.",
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
      "Le nombre d'heures par semaine ne peut pas depasser 80.",
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
    !["TEMPS_PLEIN", "TEMPS_PARTIEL"].includes(
      requestData.scheduleType
    )
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
    requestData.hrEmail &&
    !isValidEmail(requestData.hrEmail)
  ) {
    throw createError(
      "Le courriel du responsable RH est invalide.",
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
}

function formatStudentRequest(row) {
  const correctionMissingDocuments =
    parseDocumentList(
      row.correctionMissingDocuments
    );
  const correctionRequestedByName = [
    row.correctionRequestedByFirstName,
    row.correctionRequestedByLastName
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...row,
    isPaid: Boolean(row.isPaid),
    correctionMissingDocuments,
    correctionRequestedByName,
    correctionRequestedByLabel:
      correctionRequestedByName ||
      row.correctionRequestedByRole ||
      ""
  };
}

function makeCompanyCode(companyName) {
  const baseCode = clean(companyName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);

  return baseCode || `ENT-${Date.now()}`;
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
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    throw createError(
      `${fieldName} est obligatoire pour un stage rémunéré.`,
      400
    );
  }

  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    throw createError(
      `${fieldName} doit être un nombre valide.`,
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
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;

  if (!datePattern.test(value)) {
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
