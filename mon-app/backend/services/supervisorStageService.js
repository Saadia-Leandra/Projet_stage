import { createDbPool } from "../config/db.js";
import {
  generateContractPdfForContract,
  syncContractSignersForContract
} from "./contractService.js";
import { createNotificationForUsers } from "./notificationService.js";
import {
  getActiveRequestDocuments,
  getRequestWorkflowHistory,
  parseDocumentList
} from "./stageRequestCorrectionService.js";

const db = createDbPool();

export async function getSupervisorStageRequests(
  supervisorId
) {
  const [rows] = await db.execute(
    `
      SELECT
        d.id,
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
        d.motif_refus AS refusalReason,
        d.correction_raison AS correctionReason,
        d.correction_elements AS correctionItems,
        d.correction_documents_demandes AS correctionMissingDocuments,
        d.correction_commentaire_etudiant AS correctionStudentComment,
        d.correction_demandee_le AS correctionRequestedAt,
        d.resoumis_le AS resubmittedAt,
        d.cree_le AS createdAt,
        d.modifie_le AS updatedAt,
        d.decide_le AS decidedAt,

        correction_user.prenom AS correctionRequestedByFirstName,
        correction_user.nom AS correctionRequestedByLastName,
        correction_user.role AS correctionRequestedByRole,

        etudiant_user.id AS studentId,
        etudiant_user.prenom AS studentFirstName,
        etudiant_user.nom AS studentLastName,
        etudiant_user.courriel AS studentEmail,
        etudiant_user.telephone AS studentPhone,

        etu.code_etudiant AS studentCode,
        etu.code_permanent AS permanentCode,
        etu.programme AS program,
        etu.cohorte AS cohort,
        etu.groupe AS studentGroup,

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

        ent.superviseur_nom AS companySupervisorName,
        ent.superviseur_titre AS companySupervisorTitle,
        ent.superviseur_courriel AS companySupervisorEmail,
        ent.superviseur_telephone AS companySupervisorPhone

      FROM demandes_stage d

      INNER JOIN dossiers_stage ds
        ON ds.id = d.dossier_stage_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = ds.etudiant_id

      INNER JOIN utilisateurs etudiant_user
        ON etudiant_user.id = etu.utilisateur_id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs correction_user
        ON correction_user.id =
          d.correction_demandee_par_utilisateur_id

      WHERE ds.superviseur_id = ?

      ORDER BY
        CASE d.statut
          WHEN 'SOUMISE' THEN 1
          WHEN 'A_REVISER' THEN 2
          WHEN 'DOCUMENTS_MANQUANTS' THEN 3
          WHEN 'APPROUVEE' THEN 4
          WHEN 'REFUSEE' THEN 5
          WHEN 'BROUILLON' THEN 6
          ELSE 7
        END,
        COALESCE(d.resoumis_le, d.modifie_le, d.cree_le) DESC
    `,
    [supervisorId]
  );

  return rows.map(formatRequest);
}

export async function getSupervisorStageRequestById(
  supervisorId,
  requestId
) {
  const [rows] = await db.execute(
    `
      SELECT
        d.id,
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
        d.motif_refus AS refusalReason,
        d.correction_raison AS correctionReason,
        d.correction_elements AS correctionItems,
        d.correction_documents_demandes AS correctionMissingDocuments,
        d.correction_commentaire_etudiant AS correctionStudentComment,
        d.correction_demandee_le AS correctionRequestedAt,
        d.resoumis_le AS resubmittedAt,
        d.cree_le AS createdAt,
        d.modifie_le AS updatedAt,
        d.decide_le AS decidedAt,

        correction_user.prenom AS correctionRequestedByFirstName,
        correction_user.nom AS correctionRequestedByLastName,
        correction_user.role AS correctionRequestedByRole,

        etudiant_user.id AS studentId,
        etudiant_user.prenom AS studentFirstName,
        etudiant_user.nom AS studentLastName,
        etudiant_user.courriel AS studentEmail,
        etudiant_user.telephone AS studentPhone,

        etu.code_etudiant AS studentCode,
        etu.code_permanent AS permanentCode,
        etu.programme AS program,
        etu.cohorte AS cohort,
        etu.groupe AS studentGroup,

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

        ent.superviseur_nom AS companySupervisorName,
        ent.superviseur_titre AS companySupervisorTitle,
        ent.superviseur_courriel AS companySupervisorEmail,
        ent.superviseur_telephone AS companySupervisorPhone

      FROM demandes_stage d

      INNER JOIN dossiers_stage ds
        ON ds.id = d.dossier_stage_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = ds.etudiant_id

      INNER JOIN utilisateurs etudiant_user
        ON etudiant_user.id = etu.utilisateur_id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs correction_user
        ON correction_user.id =
          d.correction_demandee_par_utilisateur_id

      WHERE d.id = ?
        AND ds.superviseur_id = ?

      LIMIT 1
    `,
    [requestId, supervisorId]
  );

  const request = rows[0];

  if (!request) {
    throw createError(
      "Demande de stage introuvable.",
      404
    );
  }

  const formattedRequest = formatRequest(request);
  const [documents, history] = await Promise.all([
    getActiveRequestDocuments(
      db,
      formattedRequest.id,
      formattedRequest.folderId
    ),
    getRequestWorkflowHistory(
      db,
      formattedRequest.folderId
    )
  ]);

  return {
    ...formattedRequest,
    documents,
    history
  };
}

export async function approveStageRequest(
  supervisorId,
  requestId
) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const request = await findAssignedRequest(
      connection,
      supervisorId,
      requestId
    );

    if (request.status !== "SOUMISE") {
      throw createError(
        "Seule une demande soumise peut être approuvée.",
        400
      );
    }

    await connection.execute(
      `
        UPDATE demandes_stage
        SET
          statut = 'APPROUVEE',
          motif_refus = NULL,
          decide_par_utilisateur_id = ?,
          decide_le = NOW()
        WHERE id = ?
      `,
      [supervisorId, requestId]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'CONTRAT_EN_COURS'
        WHERE id = ?
      `,
      [request.folderId]
    );

    const contractId = await createContractIfMissing(
      connection,
      request
    );

    await generateContractPdfForContract(
      connection,
      contractId,
      supervisorId
    );

    await createNotificationForUsers(connection, {
      title: "Demande de stage approuvee",
      message:
        "Votre demande de stage a ete approuvee.",
      type: "DEMANDE_STAGE_APPROUVEE",
      requestId,
      actionUrl: `/demandes-stage/${requestId}`,
      userIds: [request.studentId]
    });

    await createNotificationForUsers(connection, {
      title: "Contrat a completer",
      message:
        "Votre demande de stage a ete approuvee. Le contrat est pret a etre complete.",
      type: "CONTRAT_A_COMPLETER",
      requestId,
      contractId,
      actionUrl: `/contracts/${contractId}`,
      userIds: [request.studentId]
    });

    await createWorkflowEvent(connection, {
      folderId: request.folderId,
      actorId: supervisorId,
      eventType: "DEMANDE_APPROUVEE",
      oldStatus: "SOUMISE",
      newStatus: "APPROUVEE",
      comment:
        "La demande de stage a été approuvée par le superviseur."
    });

    await connection.commit();

    return {
      id: Number(requestId),
      contractId,
      status: "APPROUVEE",
      message:
        "La demande a été approuvée avec succès."
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function refuseStageRequest(
  supervisorId,
  requestId,
  refusalReason
) {
  const reason = clean(refusalReason);

  if (reason.length < 10) {
    throw createError(
      "Le motif du refus doit contenir au moins 10 caractères.",
      400
    );
  }

  if (reason.length > 2000) {
    throw createError(
      "Le motif du refus ne doit pas dépasser 2000 caractères.",
      400
    );
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const request = await findAssignedRequest(
      connection,
      supervisorId,
      requestId
    );

    if (request.status !== "SOUMISE") {
      throw createError(
        "Seule une demande soumise peut être refusée.",
        400
      );
    }

    await connection.execute(
      `
        UPDATE demandes_stage
        SET
          statut = 'REFUSEE',
          motif_refus = ?,
          decide_par_utilisateur_id = ?,
          decide_le = NOW()
        WHERE id = ?
      `,
      [
        reason,
        supervisorId,
        requestId
      ]
    );

    await connection.execute(
      `
        UPDATE dossiers_stage
        SET statut = 'DEMANDE_REFUSEE'
        WHERE id = ?
      `,
      [request.folderId]
    );

    await createWorkflowEvent(connection, {
      folderId: request.folderId,
      actorId: supervisorId,
      eventType: "DEMANDE_REFUSEE",
      oldStatus: "SOUMISE",
      newStatus: "REFUSEE",
      comment: reason
    });

    await createNotificationForUsers(connection, {
      title: "Demande de stage refusee",
      message: reason,
      type: "DEMANDE_STAGE_REFUSEE",
      requestId,
      actionUrl: `/demandes-stage/${requestId}`,
      userIds: [request.studentId]
    });

    await connection.commit();

    return {
      id: Number(requestId),
      status: "REFUSEE",
      refusalReason: reason,
      message:
        "La demande a été refusée avec succès."
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findAssignedRequest(
  connection,
  supervisorId,
  requestId
) {
  const [rows] = await connection.execute(
    `
      SELECT
        d.id,
        d.dossier_stage_id AS folderId,
        d.entreprise_id AS companyId,
        d.statut AS status,
        d.resume_taches AS taskSummary,
        d.date_debut AS startDate,
        d.date_fin AS endDate,
        d.heures_semaine AS hoursPerWeek,
        d.nombre_semaines AS numberOfWeeks,
        d.type_horaire AS scheduleType,
        d.est_remunere AS isPaid,
        d.salaire_horaire AS hourlySalary,
        d.autre_compensation AS otherCompensation,

        ds.etudiant_id AS studentId,

        etu.programme AS program

      FROM demandes_stage d

      INNER JOIN dossiers_stage ds
        ON ds.id = d.dossier_stage_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = ds.etudiant_id

      WHERE d.id = ?
        AND ds.superviseur_id = ?

      LIMIT 1
    `,
    [requestId, supervisorId]
  );

  const request = rows[0];

  if (!request) {
    throw createError(
      "Demande introuvable ou non assignée à ce superviseur.",
      404
    );
  }

  return request;
}

async function createContractIfMissing(
  connection,
  request
) {
  const totalHours =
    Number(request.hoursPerWeek || 0) *
    Number(request.numberOfWeeks || 0);

  const [existingRows] = await connection.execute(
    `
      SELECT id
      FROM contrats
      WHERE demande_stage_id = ?
      LIMIT 1
    `,
    [request.id]
  );

  if (existingRows[0]) {
    await connection.execute(
      `
        UPDATE contrats
        SET
          code_programme = ?,
          description_stage = ?,
          est_remunere = ?,
          salaire_horaire = ?,
          autre_compensation = ?,
          heures_semaine = ?,
          nombre_semaines = ?,
          total_heures = ?,
          type_horaire = ?,
          statut = 'A_COMPLETER_ETUDIANT'
        WHERE id = ?
      `,
      [
        request.program,
        request.taskSummary,
        Boolean(request.isPaid),
        request.hourlySalary,
        request.otherCompensation,
        request.hoursPerWeek,
        request.numberOfWeeks,
        Number(totalHours.toFixed(2)),
        request.scheduleType,
        existingRows[0].id
      ]
    );

    await syncContractSignersForContract(
      connection,
      existingRows[0].id
    );

    return existingRows[0].id;
  }

  const [result] = await connection.execute(
    `
      INSERT INTO contrats (
        dossier_stage_id,
        demande_stage_id,
        code_programme,
        description_stage,
        est_remunere,
        salaire_horaire,
        autre_compensation,
        heures_semaine,
        nombre_semaines,
        total_heures,
        type_horaire,
        statut
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        'A_COMPLETER_ETUDIANT'
      )
    `,
    [
      request.folderId,
      request.id,
      request.program,
      request.taskSummary,
      Boolean(request.isPaid),
      request.hourlySalary,
      request.otherCompensation,
      request.hoursPerWeek,
      request.numberOfWeeks,
      Number(totalHours.toFixed(2)),
      request.scheduleType
    ]
  );

  await syncContractSignersForContract(
    connection,
    result.insertId
  );

  return result.insertId;
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

function formatRequest(row) {
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
      "",
    studentFullName:
      `${row.studentFirstName || ""} ${
        row.studentLastName || ""
      }`.trim()
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function createError(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}
