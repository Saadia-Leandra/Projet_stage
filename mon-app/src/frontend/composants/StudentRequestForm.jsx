import { useState } from "react";

const initialForm = {
  companyName: "",
  companyCity: "",
  companyAddress: "",
  taskSummary: "",
  startDate: "",
  endDate: ""
};

export default function StudentRequestForm({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/students/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de creer la demande.");
        return;
      }

      setForm(initialForm);
      setSuccess("Demande de stage soumise.");
      onCreated();
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Nouvelle demande de stage</h2>
        <span className="statusPill">Etudiant</span>
      </div>

      <form className="studentForm" onSubmit={handleSubmit}>
        <div className="studentFormGrid">
          <label className="field">
            Entreprise
            <input
              name="companyName"
              value={form.companyName}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Ville
            <input
              name="companyCity"
              value={form.companyCity}
              onChange={updateField}
              required
            />
          </label>

          <label className="field wide">
            Adresse
            <input
              name="companyAddress"
              value={form.companyAddress}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Date de debut
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Date de fin
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={updateField}
              required
            />
          </label>

          <label className="field wide">
            Resume des taches
            <textarea
              name="taskSummary"
              value={form.taskSummary}
              onChange={updateField}
              rows="4"
              required
            />
          </label>
        </div>

        {error && <div className="studentError">{error}</div>}
        {success && <div className="studentSuccess">{success}</div>}

        <button className="primaryButton fitButton" type="submit" disabled={loading}>
          {loading ? "Envoi..." : "Soumettre la demande"}
        </button>
      </form>
    </section>
  );
}
