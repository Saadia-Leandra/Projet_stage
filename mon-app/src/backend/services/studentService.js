import { createDbPool } from "../config/db.js";

const db = createDbPool();

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
        d.cree_le AS createdAt,
        d.modifie_le AS updatedAt,

        ent.id AS companyId,
        ent.nom AS companyName,
        ent.neq AS companyNeq,
        ent.adresse AS companyAddress,
        ent.ville AS companyCity,
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

      INNER JOIN demandes_stage d
        ON d.dossier_stage_id = ds.id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      WHERE ds.etudiant_id = ?

      ORDER BY d.cree_le DESC
    `,
    [studentId]
  );

  return rows.map((row) => ({
    ...row,
    isPaid: Boolean(row.isPaid)
  }));
}

export async function createInternshipRequest(
  studentId,
  data
) {
  const requestData = validateRequestData(data);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const student = await getStudentProfile(
      studentId,
      connection
    );

    const companyId = await createCompany(
      connection,
      requestData
    );

    const folderId = await findOrCreateFolder(
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
          ?, ?, ?, ?, ?, ?, ?, 'SOUMISE'
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
        requestData.otherCompensation
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'DEMANDE_SOUMISE'
        WHERE id = ?
      `,
      [folderId]
    );

    await connection.commit();

    return {
      id: result.insertId,
      folderId,
      companyId,
      ...requestData,
      status: "SOUMISE"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
        e.code_permanent AS codePermanent,
        e.code_etudiant AS studentCode,
        e.programme,
        e.groupe,
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
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )

      ON DUPLICATE KEY UPDATE
        nom = VALUES(nom),
        neq = VALUES(neq),
        adresse = VALUES(adresse),
        ville = VALUES(ville),
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

async function findOrCreateFolder(
  connection,
  student
) {
  const [folderRows] = await connection.execute(
    `
      SELECT id
      FROM dossiers_stage
      WHERE etudiant_id = ?
      ORDER BY cree_le DESC
      LIMIT 1
    `,
    [student.id]
  );

  if (folderRows[0]) {
    return folderRows[0].id;
  }

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
    ["Le résumé des tâches", requestData.taskSummary],
    ["Le nom de l’entreprise", requestData.companyName],
    ["L’adresse", requestData.companyAddress],
    ["La ville", requestData.companyCity],
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

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}