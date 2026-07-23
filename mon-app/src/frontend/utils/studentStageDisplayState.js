const activeRequestStatuses = new Set([
  "BROUILLON",
  "SOUMISE",
  "A_REVISER",
  "DOCUMENTS_MANQUANTS",
  "APPROUVEE"
]);

const terminalRequestStatuses = new Set([
  "REFUSEE",
  "ANNULEE"
]);

const correctionStatuses = new Set([
  "A_REVISER",
  "DOCUMENTS_MANQUANTS"
]);

const studentEditableStatuses = new Set([
  "BROUILLON",
  "A_REVISER",
  "DOCUMENTS_MANQUANTS"
]);

const studentWithdrawableStatuses = new Set([
  "BROUILLON",
  "SOUMISE"
]);

export function isActiveStudentStageRequest(request) {
  if (!request) {
    return false;
  }

  if (terminalRequestStatuses.has(request.status)) {
    return false;
  }

  return activeRequestStatuses.has(request.status);
}

export function getStudentStageDisplayState({
  request = null,
  requestStatus = request?.status,
  contract = null,
  contractStatus = contract?.status,
  signatureStatus = contract?.documensoStatus,
  missingDocuments =
    request?.correctionMissingDocuments || [],
  revisionRequired =
    requestStatus === "A_REVISER"
}) {
  if (!requestStatus || !request) {
    return {
      color: "yellow",
      colorClass: "statusYellow",
      label: "Demande non creee",
      title:
        "Vous n'avez pas encore cree votre demande de stage.",
      message:
        "Vous pouvez commencer une demande et l'enregistrer en brouillon avant de la soumettre.",
      nextStep:
        "Creer et completer la demande de stage.",
      actionLabel: "Creer ma demande de stage",
      actionType: "create",
      targetView: "requests",
      progressStep: 1,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: false,
      canSign: false,
      canDownload: false
    };
  }

  if (contractStatus === "DOSSIER_COMPLET") {
    return {
      color: "green",
      colorClass: "statusGreen",
      label: "Stage approuve",
      title: "Dossier complet et approuve",
      message:
        "Votre dossier de stage est complet et approuve. Vous pouvez commencer votre stage.",
      nextStep: "Consulter ou telecharger le contrat final.",
      actionLabel: "Telecharger mon contrat final",
      actionType: "downloadFinal",
      targetView: "contracts",
      progressStep: 9,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: false,
      canSign: false,
      canDownload: true
    };
  }

  if (
    requestStatus === "REFUSEE" ||
    contractStatus === "REJETE" ||
    signatureStatus === "REJECTED" ||
    signatureStatus === "CANCELLED"
  ) {
    return {
      color: "red",
      colorClass: "statusRed",
      label: "Demande refusee",
      title: "Votre demande a ete refusee.",
      message:
        request?.refusalReason ||
        "La demande est conservee dans votre historique administratif.",
      nextStep:
        "Consulter le motif de refus dans l'historique.",
      actionLabel: "Consulter mon dossier",
      actionType: "view",
      targetView: "requests",
      progressStep: 2,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: false,
      canSign: false,
      canDownload: false
    };
  }

  if (requestStatus === "ANNULEE") {
    return {
      color: "yellow",
      colorClass: "statusYellow",
      label: "Retiree par l'etudiant",
      title: "Cette demande a ete retiree.",
      message:
        "Elle reste conservee dans votre historique administratif.",
      nextStep:
        "Vous pouvez creer une nouvelle demande de stage.",
      actionLabel: "Creer ma demande de stage",
      actionType: "create",
      targetView: "requests",
      progressStep: 1,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: false,
      canSign: false,
      canDownload: false
    };
  }

  if (revisionRequired || requestStatus === "A_REVISER") {
    return {
      color: "red",
      colorClass: "statusRed",
      label: "Corrections demandees",
      title: "Des elements doivent etre corriges.",
      message:
        request?.correctionStudentComment ||
        request?.correctionReason ||
        "Corrigez les elements demandes puis resoumettez la meme demande.",
      nextStep:
        "Modifier la demande et la soumettre a nouveau.",
      actionLabel: "Corriger et soumettre a nouveau",
      actionType: "edit",
      targetView: "requests",
      progressStep: 2,
      canEdit: true,
      canWithdraw: false,
      canSubmit: true,
      canUpload: false,
      canSign: false,
      canDownload: false
    };
  }

  if (requestStatus === "DOCUMENTS_MANQUANTS") {
    return {
      color: "red",
      colorClass: "statusRed",
      label: "Documents manquants",
      title: "Des documents doivent etre ajoutes.",
      message:
        missingDocuments.length > 0
          ? `Documents attendus : ${missingDocuments.join(", ")}.`
          : "Ajoutez les documents demandes puis resoumettez la meme demande.",
      nextStep:
        "Ajouter ou remplacer les documents demandes.",
      actionLabel: "Ajouter les documents manquants",
      actionType: "edit",
      targetView: "requests",
      progressStep: 2,
      canEdit: true,
      canWithdraw: false,
      canSubmit: true,
      canUpload: true,
      canSign: false,
      canDownload: false
    };
  }

  if (requestStatus === "BROUILLON") {
    return {
      color: "orange",
      colorClass: "statusOrange",
      label: "Brouillon",
      title:
        "Votre demande est enregistree en brouillon.",
      message:
        "Vous pouvez continuer a la remplir avant de la soumettre.",
      nextStep:
        "Completer la demande ou la soumettre lorsque tout est pret.",
      actionLabel: "Continuer ma demande",
      actionType: "edit",
      targetView: "requests",
      progressStep: 1,
      canEdit: true,
      canWithdraw: true,
      canSubmit: true,
      canUpload: false,
      canSign: false,
      canDownload: false
    };
  }

  if (requestStatus === "SOUMISE") {
    return {
      color: "orange",
      colorClass: "statusOrange",
      label: "Demande soumise",
      title:
        "Votre demande est en attente de traitement.",
      message:
        "Le superviseur doit analyser la demande avant la generation du contrat.",
      nextStep:
        "Attendre le traitement ou retirer la demande si le traitement n'a pas commence.",
      actionLabel: "Voir ma demande",
      actionType: "view",
      targetView: "requests",
      progressStep: 2,
      canEdit: false,
      canWithdraw: true,
      canSubmit: false,
      canUpload: false,
      canSign: false,
      canDownload: false
    };
  }

  if (contractStatus === "A_COMPLETER_ETUDIANT") {
    return {
      color: "orange",
      colorClass: "statusOrange",
      label: "Contrat a completer",
      title:
        "Votre demande a ete approuvee. Completez maintenant votre contrat.",
      message:
        "Le contrat officiel est prepare a partir du modele de l'ecole.",
      nextStep:
        "Completer les champs restants du contrat.",
      actionLabel: "Completer mon contrat",
      actionType: "contract",
      targetView: "contracts",
      progressStep: 3,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: false,
      canSign: false,
      canDownload: true
    };
  }

  if (contractStatus === "SIGNATURE_ETUDIANT") {
    return {
      color: "orange",
      colorClass: "statusOrange",
      label: "Signature etudiante",
      title: "Votre signature est requise.",
      message:
        "La suite avance seulement apres la confirmation reelle de Documenso.",
      nextStep: "Signer votre partie du contrat.",
      actionLabel: "Enregistrer et signer",
      actionType: "sign",
      targetView: "contracts",
      progressStep: 4,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: false,
      canSign: true,
      canDownload: true
    };
  }

  if (contractStatus === "CONTRAT_MILIEU_A_DEPOSER") {
    return {
      color: "orange",
      colorClass: "statusOrange",
      label: "Signature du milieu",
      title:
        "Votre contrat doit etre signe par le milieu de stage.",
      message:
        "Deposez ensuite le PDF signe par le milieu dans StageTec.",
      nextStep:
        "Deposer le contrat signe par le milieu.",
      actionLabel:
        "Deposer le contrat signe par le milieu",
      actionType: "uploadMilieu",
      targetView: "contracts",
      progressStep: 5,
      canEdit: false,
      canWithdraw: false,
      canSubmit: false,
      canUpload: true,
      canSign: false,
      canDownload: true
    };
  }

  if (contractStatus === "SIGNATURE_SUPERVISEUR") {
    return signatureWaitingState({
      label: "Signature enseignant",
      title:
        "Votre contrat est en attente de signature de l'enseignant.",
      progressStep: 6
    });
  }

  if (contractStatus === "SIGNATURE_CONSEILLERE") {
    return signatureWaitingState({
      label: "Signature conseillere",
      title:
        "Votre contrat est en attente de signature de la conseillere.",
      progressStep: 7
    });
  }

  if (contractStatus === "SIGNATURE_DIRECTION") {
    return signatureWaitingState({
      label: "Signature direction",
      title:
        "Votre contrat est en attente de signature de la direction.",
      progressStep: 8
    });
  }

  return {
    color: "orange",
    colorClass: "statusOrange",
    label: "Processus en cours",
    title: "Votre dossier de stage est en cours.",
    message:
      requestStatus === "APPROUVEE"
        ? "Votre demande a ete approuvee. Le contrat doit etre complete."
        : "StageTec attend la prochaine action du workflow.",
    nextStep: "Suivre l'avancement du dossier.",
    actionLabel: "Suivre le processus",
    actionType: "follow",
    targetView: contract ? "contracts" : "requests",
    progressStep: requestStatus === "APPROUVEE" ? 2 : 1,
    canEdit: studentEditableStatuses.has(requestStatus),
    canWithdraw: studentWithdrawableStatuses.has(requestStatus),
    canSubmit: false,
    canUpload: false,
    canSign: false,
    canDownload: Boolean(contract?.generatedPdfAvailable)
  };
}

export function studentCanEditRequest(request) {
  return studentEditableStatuses.has(request?.status);
}

export function studentCanWithdrawRequest(request) {
  return studentWithdrawableStatuses.has(request?.status);
}

export function isCorrectionRequestStatus(status) {
  return correctionStatuses.has(status);
}

function signatureWaitingState({
  label,
  title,
  progressStep
}) {
  return {
    color: "orange",
    colorClass: "statusOrange",
    label,
    title,
    message:
      "Les signatures administratives suivent l'ordre prevu.",
    nextStep: "Attendre la confirmation de signature.",
    actionLabel: "Suivre le processus",
    actionType: "follow",
    targetView: "contracts",
    progressStep,
    canEdit: false,
    canWithdraw: false,
    canSubmit: false,
    canUpload: false,
    canSign: false,
    canDownload: false
  };
}
