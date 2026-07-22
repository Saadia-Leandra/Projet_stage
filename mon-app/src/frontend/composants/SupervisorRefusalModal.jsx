import { useState } from "react";

export default function SupervisorRefusalModal({
  request,
  loading,
  onConfirm,
  onCancel
}) {
  const [refusalReason, setRefusalReason] =
    useState("");

  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    const reason = refusalReason.trim();

    if (reason.length < 10) {
      setError(
        "Le motif du refus doit contenir au moins 10 caractères."
      );

      return;
    }

    if (reason.length > 2000) {
      setError(
        "Le motif du refus ne doit pas dépasser 2000 caractères."
      );

      return;
    }

    const confirmed = window.confirm(
      "Confirmer le refus definitif de cette demande ? L'etudiant ne pourra plus la modifier."
    );

    if (!confirmed) {
      return;
    }

    setError("");

    const success = await onConfirm(
      request,
      reason
    );

    if (success) {
      setRefusalReason("");
    }
  }

  return (
    <div className="modalOverlay">
      <div
        className="modalCard refusalModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="refusal-modal-title"
      >
        <div className="panelHeader">
          <div>
            <h2 id="refusal-modal-title">
              Refuser definitivement
            </h2>

            <p>
              {request.studentFullName || "Étudiant"} —{" "}
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
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field wide">
            Motif du refus *

            <textarea
              value={refusalReason}
              onChange={(event) =>
                setRefusalReason(
                  event.target.value
                )
              }
              rows={7}
              minLength={10}
              maxLength={2000}
              placeholder="Expliquez clairement pourquoi cette demande est fermee definitivement."
              disabled={loading}
              required
            />
          </label>

          <div className="characterCounter">
            {refusalReason.length}/2000
          </div>

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
              className="dangerButton"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Envoi en cours..."
                : "Refuser definitivement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
