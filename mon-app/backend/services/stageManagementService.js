import { createDbPool } from "../config/db.js";

const db = createDbPool();

export async function getStageContractsForUser(user) {
  const [rows] = await db.execute(
    `
      SELECT
        ${contractColumns()},
        (
          SELECT COUNT(*)
          FROM signatures_contrat sc_signed
          WHERE sc_signed.contrat_id = c.id
            AND sc_signed.statut = 'SIGNE'
            AND sc_signed.role_signataire IN (
              'ETUDIANT',
              'ENTREPRISE',
              'SUPERVISEUR',
              'CONSEILLERE',
              'DIRECTION'
            )
        ) AS signedCount,
        (
          SELECT COUNT(*)
          FROM signatures_contrat sc_count
          WHERE sc_count.contrat_id = c.id
            AND sc_count.role_signataire IN (
              'ETUDIANT',
              'ENTREPRISE',
              'SUPERVISEUR',
              'CONSEILLERE',
              'DIRECTION'
            )
        ) AS signerCount,
        (
          SELECT MIN(sc_next.ordre_signature)
          FROM signatures_contrat sc_next
          WHERE sc_next.contrat_id = c.id
            AND sc_next.statut <> 'SIGNE'
            AND sc_next.role_signataire IN (
              'ETUDIANT',
              'ENTREPRISE',
              'SUPERVISEUR',
              'CONSEILLERE',
              'DIRECTION'
            )
        ) AS nextSigningOrder

      FROM contrats c

      INNER JOIN demandes_stage d
        ON d.id = c.demande_stage_id

      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      WHERE ${accessCondition(user)}

      ORDER BY
        CASE c.statut
          WHEN 'A_COMPLETER_ETUDIANT' THEN 1
          WHEN 'SIGNATURE_ETUDIANT' THEN 2
          WHEN 'CONTRAT_MILIEU_A_DEPOSER' THEN 3
          WHEN 'SIGNATURE_ENTREPRISE' THEN 4
          WHEN 'SIGNATURE_SUPERVISEUR' THEN 5
          WHEN 'SIGNATURE_CONSEILLERE' THEN 6
          WHEN 'SIGNATURE_DIRECTION' THEN 7
          WHEN 'REJETE' THEN 8
          WHEN 'DOSSIER_COMPLET' THEN 9
          ELSE 8
        END,
        c.cree_le DESC
    `,
    accessParams(user)
  );

  const contracts = [];

  for (const row of rows) {
    contracts.push({
      ...formatContract(row),
      signers: await getContractSigners(row.id)
    });
  }

  return contracts;
}

export async function getStageContractForUser(
  user,
  contractId
) {
  const [rows] = await db.execute(
    `
      SELECT
        ${contractColumns()}

      FROM contrats c

      INNER JOIN demandes_stage d
        ON d.id = c.demande_stage_id

      INNER JOIN dossiers_stage ds
        ON ds.id = c.dossier_stage_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      WHERE c.id = ?
        AND ${accessCondition(user)}

      LIMIT 1
    `,
    [contractId, ...accessParams(user)]
  );

  const contract = rows[0];

  if (!contract) {
    const error = new Error(
      "Contrat introuvable ou acces refuse."
    );
    error.status = 404;
    throw error;
  }

  return {
    ...formatContract(contract),
    signers: await getContractSigners(contract.id)
  };
}

export async function getStageRequestsForUser(user) {
  const [rows] = await db.execute(
    `
      SELECT
        d.id,
        d.statut AS status,
        d.resume_taches AS taskSummary,
        d.date_debut AS startDate,
        d.date_fin AS endDate,
        d.cree_le AS createdAt,
        d.modifie_le AS updatedAt,
        d.resoumis_le AS resubmittedAt,
        d.correction_raison AS correctionReason,
        d.correction_documents_demandes AS correctionMissingDocuments,
        d.decide_le AS decidedAt,

        ds.id AS folderId,
        ds.statut AS folderStatus,

        student_user.id AS studentId,
        CONCAT(
          student_user.prenom,
          ' ',
          student_user.nom
        ) AS studentName,
        student_user.courriel AS studentEmail,
        etu.code_etudiant AS studentCode,
        etu.programme AS program,

        ent.nom AS companyName,
        ent.ville AS companyCity,

        teacher_user.id AS teacherId,
        CONCAT(
          teacher_user.prenom,
          ' ',
          teacher_user.nom
        ) AS teacherName

      FROM demandes_stage d

      INNER JOIN dossiers_stage ds
        ON ds.id = d.dossier_stage_id

      INNER JOIN utilisateurs student_user
        ON student_user.id = ds.etudiant_id

      INNER JOIN etudiants etu
        ON etu.utilisateur_id = student_user.id

      INNER JOIN entreprises ent
        ON ent.id = d.entreprise_id

      LEFT JOIN utilisateurs teacher_user
        ON teacher_user.id = ds.superviseur_id

      WHERE ${accessCondition(user)}

      ORDER BY
        CASE d.statut
          WHEN 'SOUMISE' THEN 1
          WHEN 'A_REVISER' THEN 2
          WHEN 'DOCUMENTS_MANQUANTS' THEN 3
          WHEN 'APPROUVEE' THEN 4
          WHEN 'REFUSEE' THEN 5
          ELSE 6
        END,
        COALESCE(d.resoumis_le, d.modifie_le, d.cree_le) DESC
    `,
    accessParams(user)
  );

  return rows;
}

async function getContractSigners(contractId) {
  const [rows] = await db.execute(
    `
      SELECT
        id,
        ordre_signature AS signingOrder,
        role_signataire AS role,
        nom_signataire AS name,
        courriel_signataire AS email,
        statut AS status,
        signe_le AS signedAt
      FROM signatures_contrat
      WHERE contrat_id = ?
        AND role_signataire IN (
          'ETUDIANT',
          'ENTREPRISE',
          'SUPERVISEUR',
          'CONSEILLERE',
          'DIRECTION'
        )
      ORDER BY ordre_signature ASC
    `,
    [contractId]
  );

  return rows.map((row) => ({
    ...row,
    signingOrder: Number(row.signingOrder),
    label: signerRoleLabel(row.role)
  }));
}

function contractColumns() {
  return `
    c.id,
    c.dossier_stage_id AS folderId,
    c.demande_stage_id AS requestId,
    c.statut AS status,
    c.documenso_status AS documensoStatus,
    c.submitted_at AS submittedAt,
    c.completed_at AS completedAt,
    c.rejected_at AS rejectedAt,
    c.cree_le AS createdAt,

    d.statut AS requestStatus,
    d.date_debut AS startDate,
    d.date_fin AS endDate,

    ds.statut AS folderStatus,

    student_user.id AS studentId,
    CONCAT(
      student_user.prenom,
      ' ',
      student_user.nom
    ) AS studentName,
    student_user.courriel AS studentEmail,
    etu.code_etudiant AS studentCode,
    etu.programme AS program,

    ent.nom AS companyName,
    ent.ville AS companyCity,

    teacher_user.id AS teacherId,
    CONCAT(
      teacher_user.prenom,
      ' ',
      teacher_user.nom
    ) AS teacherName
  `;
}

function accessCondition(user) {
  if (user.role === "SUPERVISEUR") {
    return "ds.superviseur_id = ?";
  }

  return "1 = ?";
}

function accessParams(user) {
  if (user.role === "SUPERVISEUR") {
    return [user.id];
  }

  return [1];
}

function formatContract(row) {
  return {
    ...row,
    signedCount: Number(row.signedCount || 0),
    signerCount: Number(row.signerCount || 0),
    nextSigningOrder: row.nextSigningOrder
      ? Number(row.nextSigningOrder)
      : null
  };
}

function signerRoleLabel(role) {
  const labels = {
    ENTREPRISE: "Milieu de stage",
    ETUDIANT: "Etudiant",
    SUPERVISEUR: "Enseignant",
    CONSEILLERE: "Conseillere",
    DIRECTION: "Direction"
  };

  return labels[role] || role || "-";
}
