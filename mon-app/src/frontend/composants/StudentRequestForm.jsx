import { useState } from "react";

const initialForm = {
  taskSummary: "",
  startDate: "",
  endDate: "",
  companyName: "",
  companyAddress: "",
  companyCity: "",
  companyPostalCode: "",
  companyPhone: "",
  companyExtension: "",
  companyEmail: "",
  companyWebsite: "",
  hrName: "",
  hrEmail: "",
  hrPhone: "",
  hrExtension: "",
  workSchedule: "",
  weeklyHours: "",
  workLanguage: "",
  supervisorName: "",
  supervisorTitle: "",
  supervisorEmail: ""
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
        <h3>Identification du stage</h3>
        <div className="studentFormGrid">
          <label className="field wide">
            Resume des taches
            <textarea
              name="taskSummary"
              value={form.taskSummary}
              onChange={updateField}
              rows="5"
              required
            />
          </label>

          <label className="field">
            Debut de disponibilite
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Fin de disponibilite
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={updateField}
              required
            />
          </label>
        </div>

        <h3>Identification du milieu de stage</h3>
        <div className="studentFormGrid">
          <label className="field">
            Nom du milieu
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
            Code postal
            <input
              name="companyPostalCode"
              value={form.companyPostalCode}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Telephone
            <input
              name="companyPhone"
              value={form.companyPhone}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Poste
            <input
              name="companyExtension"
              value={form.companyExtension}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Courriel du milieu
            <input
              type="email"
              name="companyEmail"
              value={form.companyEmail}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Site internet
            <input
              name="companyWebsite"
              value={form.companyWebsite}
              onChange={updateField}
            />
          </label>
        </div>

        <h3>Ressources humaines et horaire</h3>
        <div className="studentFormGrid">
          <label className="field">
            Responsable RH
            <input name="hrName" value={form.hrName} onChange={updateField} />
          </label>

          <label className="field">
            Courriel RH
            <input type="email" name="hrEmail" value={form.hrEmail} onChange={updateField} />
          </label>

          <label className="field">
            Telephone RH
            <input name="hrPhone" value={form.hrPhone} onChange={updateField} />
          </label>

          <label className="field">
            Poste RH
            <input name="hrExtension" value={form.hrExtension} onChange={updateField} />
          </label>

          <label className="field">
            Horaire de travail
            <input name="workSchedule" value={form.workSchedule} onChange={updateField} />
          </label>

          <label className="field">
            Heures par semaine
            <input
              type="number"
              min="0"
              step="0.5"
              name="weeklyHours"
              value={form.weeklyHours}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Langue de travail
            <input name="workLanguage" value={form.workLanguage} onChange={updateField} />
          </label>
        </div>

        <h3>Superviseur associe en entreprise</h3>
        <div className="studentFormGrid">
          <label className="field">
            Nom
            <input name="supervisorName" value={form.supervisorName} onChange={updateField} />
          </label>

          <label className="field">
            Titre professionnel
            <input name="supervisorTitle" value={form.supervisorTitle} onChange={updateField} />
          </label>

          <label className="field wide">
            Courriel
            <input
              type="email"
              name="supervisorEmail"
              value={form.supervisorEmail}
              onChange={updateField}
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
