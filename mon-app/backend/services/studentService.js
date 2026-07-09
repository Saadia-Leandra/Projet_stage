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
        ent.nom AS companyName,
        ent.ville AS companyCity,
        ent.adresse AS companyAddress,
        d.resume_taches AS taskSummary,
        d.date_debut AS startDate,
        d.date_fin AS endDate,
        d.statut AS status,
        d.motif_refus AS refusalReason,
        d.cree_le AS createdAt
      FROM dossiers_stage ds
      LEFT JOIN demandes_stage d ON d.dossier_stage_id = ds.id
      LEFT JOIN entreprises ent ON ent.id = d.entreprise_id
      WHERE ds.etudiant_id = ?
      ORDER BY d.cree_le DESC, ds.cree_le DESC
    `,
    [studentId]
  );

  return rows.filter((row) => row.id);
}

export async function createInternshipRequest(studentId, data) {
  const companyName = clean(data.companyName);
  const companyCity = clean(data.companyCity);
  const companyAddress = clean(data.companyAddress);
  const companyPostalCode = clean(data.companyPostalCode);
  const companyPhone = clean(data.companyPhone);
  const companyExtension = clean(data.companyExtension);
  const companyEmail = clean(data.companyEmail);
  const companyWebsite = clean(data.companyWebsite);
  const hrName = clean(data.hrName);
  const hrEmail = clean(data.hrEmail);
  const hrPhone = clean(data.hrPhone);
  const hrExtension = clean(data.hrExtension);
  const workSchedule = clean(data.workSchedule);
  const weeklyHours = clean(data.weeklyHours);
  const workLanguage = clean(data.workLanguage);
  const supervisorName = clean(data.supervisorName);
  const supervisorEmail = clean(data.supervisorEmail);
  const taskSummary = clean(data.taskSummary);
  const startDate = clean(data.startDate);
  const endDate = clean(data.endDate);

  if (!companyName || !companyCity || !companyAddress || !taskSummary || !startDate || !endDate) {
    throw createError("Tous les champs obligatoires doivent etre remplis.", 400);
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const student = await getStudentProfile(studentId, connection);
    const companyId = await createCompany(connection, {
      companyName,
      companyCity,
      companyAddress,
      companyPostalCode,
      companyPhone,
      companyExtension,
      companyEmail,
      companyWebsite,
      hrName,
      hrEmail,
      hrPhone,
      hrExtension,
      workSchedule,
      weeklyHours,
      workLanguage,
      supervisorName,
      supervisorEmail
    });
    const folderId = await findOrCreateFolder(connection, student);

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
          statut
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SOUMISE')
      `,
      [folderId, companyId, taskSummary, startDate, endDate, startDate, endDate]
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
      companyName,
      companyCity,
      companyAddress,
      companyPostalCode,
      companyPhone,
      companyExtension,
      companyEmail,
      companyWebsite,
      hrName,
      hrEmail,
      hrPhone,
      hrExtension,
      workSchedule,
      weeklyHours,
      workLanguage,
      supervisorName,
      supervisorEmail,
      taskSummary,
      startDate,
      endDate,
      status: "SOUMISE"
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getStudentProfile(studentId, connection = db) {
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
      INNER JOIN etudiants e ON e.utilisateur_id = u.id
      WHERE u.id = ?
    `,
    [studentId]
  );

  const student = studentRows[0];

  if (!student) {
    throw createError("Etudiant introuvable.", 404);
  }

  return student;
}

async function createCompany(connection, data) {
  const code = makeCompanyCode(data.companyName);

  const [result] = await connection.execute(
    `
      INSERT INTO entreprises (
        code,
        nom,
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
        contact_signature_nom,
        contact_signature_courriel,
        horaire_travail,
        heures_semaine,
        langue_travail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nom = VALUES(nom),
        adresse = VALUES(adresse),
        ville = VALUES(ville),
        code_postal = VALUES(code_postal),
        telephone = VALUES(telephone),
        poste_telephonique = VALUES(poste_telephonique),
        courriel = VALUES(courriel),
        site_web = VALUES(site_web),
        contact_rh_nom = VALUES(contact_rh_nom),
        contact_rh_courriel = VALUES(contact_rh_courriel),
        contact_rh_telephone = VALUES(contact_rh_telephone),
        contact_signature_nom = VALUES(contact_signature_nom),
        contact_signature_courriel = VALUES(contact_signature_courriel),
        horaire_travail = VALUES(horaire_travail),
        heures_semaine = VALUES(heures_semaine),
        langue_travail = VALUES(langue_travail),
        id = LAST_INSERT_ID(id)
    `,
    [
      code,
      data.companyName,
      data.companyAddress,
      data.companyCity,
      nullable(data.companyPostalCode),
      nullable(data.companyPhone),
      nullable(data.companyExtension),
      nullable(data.companyEmail),
      nullable(data.companyWebsite),
      nullable(data.hrName),
      nullable(data.hrEmail),
      nullable(formatPhoneWithExtension(data.hrPhone, data.hrExtension)),
      nullable(formatNameWithTitle(data.supervisorName, data.supervisorTitle)),
      nullable(data.supervisorEmail),
      nullable(data.workSchedule),
      numberOrNull(data.weeklyHours),
      nullable(data.workLanguage)
    ]
  );

  return result.insertId;
}

async function findOrCreateFolder(connection, student) {
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
      ) VALUES (?, ?, 'DEMANDE_SOUMISE')
    `,
    [student.id, student.supervisorId]
  );

  return result.insertId;
}

function makeCompanyCode(companyName) {
  return clean(companyName)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function clean(value) {
  return String(value || "").trim();
}

function nullable(value) {
  const cleanedValue = clean(value);
  return cleanedValue || null;
}

function numberOrNull(value) {
  const cleanedValue = clean(value);
  return cleanedValue ? Number(cleanedValue) : null;
}

function formatPhoneWithExtension(phone, extension) {
  const cleanedPhone = clean(phone);
  const cleanedExtension = clean(extension);

  if (!cleanedPhone) {
    return "";
  }

  return cleanedExtension ? `${cleanedPhone} poste ${cleanedExtension}` : cleanedPhone;
}

function formatNameWithTitle(name, title) {
  const cleanedName = clean(name);
  const cleanedTitle = clean(title);

  if (!cleanedName) {
    return "";
  }

  return cleanedTitle ? `${cleanedName} - ${cleanedTitle}` : cleanedName;
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}
