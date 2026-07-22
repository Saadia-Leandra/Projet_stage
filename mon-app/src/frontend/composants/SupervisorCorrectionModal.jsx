import { useState } from "react";

const documentOptions = [
  ["ATTESTATION", "Attestation"],
  ["CAQ", "CAQ"],
  ["PERMIS_ETUDES", "Permis d'etudes"],
  ["ASSURANCE", "Assurance"],
  ["PIECE_IDENTITE", "Piece d'identite"],
  ["CV", "CV"],
  ["AUTRE", "Autre document"]
];

export default function SupervisorCorrectionModal({
  request,
  status,
  loading,
  onConfirm,
  onCancel
}) {
  const [reason, setReason] = useState("");
  const [correctionItems, setCorrectionItems] =
    useState("");
  const [studentComment, setStudentComment] =
    useState("");
  const [missingDocuments, setMissingDocuments] =
    useState([]);
  const [error, setError] = useState("");

  const isDocumentsMode =
    status === "DOCUMENTS_MANQUANTS";

  function toggleDocument(documentType) {
    setMissingDocuments((current) =>
      current.includes(documentType)
        ? current.filter((item) => item !== documentType)
        : [...current, documentType]
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      status,
      reason: reason.trim(),
      correctionItems: correctionItems.trim(),
      studentComment: studentComment.trim(),
      missingDocuments
    };

    if (payload.reason.length < 10) {
      setError(
        "La raison doit contenir au moins 10 caracteres."
      );
      return;
    }

    if (payload.correctionItems.length < 3) {
      setError(
        "Indiquez les elements a corriger."
      );
      return;
    }

    if (payload.studentComment.length < 10) {
      setError(
        "Le commentaire destine a l'etudiant est obligatoire."
      );
      return;
    }

    if (
      isDocumentsMode &&
      !payload.missingDocuments.length
    ) {
      setError(
        "Selectionnez au moins un document manquant."
      );
      return;
    }

    setError("");

    const success = await onConfirm(
      request,
      payload
    );

    if (success) {
      setReason("");
      setCorrectionItems("");
      setStudentComment("");
      setMissingDocuments([]);
    }
  }

  return (
    <div className="modalOverlay">
      <div
        className="modalCard refusalModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-modal-title"
      >
        <div className="panelHeader">
          <div>
            <h2 id="correction-modal-title">
              {isDocumentsMode
                ? "Documents manquants"
                : "Demander des corrections"}
            </h2>

            <p>
              {request.studentFullName || "Etudiant"} -{" "}
              {request.companyName || "Entreprise"}
            </p>
          </div>

          <button
            className="modalCloseButton"
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Fermer"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="field wide">
            Raison *
            <textarea
              value={reason}
              onChange={(event) =>
                setReason(event.target.value)
              }
              rows={3}
              maxLength={2000}
              placeholder="Exemple : information incoherente, document illisible ou champ incomplet."
              disabled={loading}
              required
            />
          </label>

          <label className="field wide">
            Elements a corriger *
            <textarea
              value={correctionItems}
              onChange={(event) =>
                setCorrectionItems(
                  event.target.value
                )
              }
              rows={4}
              maxLength={2000}
              placeholder="Listez les champs ou informations a reprendre."
              disabled={loading}
              required
            />
          </label>

          <div className="field wide">
            <span>Documents demandes</span>

            <div className="documentChoiceGrid">
              {documentOptions.map(
                ([documentType, label]) => (
                  <label
                    className="checkboxField"
                    key={documentType}
                  >
                    <input
                      type="checkbox"
                      checked={missingDocuments.includes(
                        documentType
                      )}
                      onChange={() =>
                        toggleDocument(documentType)
                      }
                      disabled={loading}
                    />
                    {label}
                  </label>
                )
              )}
            </div>
          </div>

          <label className="field wide">
            Commentaire pour l'etudiant *
            <textarea
              value={studentComment}
              onChange={(event) =>
                setStudentComment(
                  event.target.value
                )
              }
              rows={5}
              maxLength={2000}
              placeholder="Expliquez clairement ce que l'etudiant doit faire avant de resoumettre."
              disabled={loading}
              required
            />
          </label>

          {error && (
            <div className="studentError">
              {error}
            </div>
          )}

          <div className="modalActions">
            <button
              className="secondaryButton"
              type="button"
              onClick={onCancel}
              disabled={loading}
            >
              Annuler
            </button>

            <button
              className="primaryButton"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Envoi en cours..."
                : "Envoyer la demande"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
