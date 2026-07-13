import { useState } from "react";

const initialForm = {
  // Identification du stage
  taskSummary: "",
  startDate: "",
  endDate: "",

  // Entreprise
  companyName: "",
  companyNeq: "",
  companyAddress: "",
  companyCity: "",
  companyPostalCode: "",
  companyPhone: "",
  companyPhoneExtension: "",
  companyEmail: "",
  companyWebsite: "",
  organizationType: "PRIVE",
  businessSector: "",

  // Responsable des ressources humaines
  hrName: "",
  hrEmail: "",
  hrPhone: "",
  hrExtension: "",

  // Superviseur en entreprise
  supervisorName: "",
  supervisorTitle: "",
  supervisorEmail: "",
  supervisorPhone: "",

  // Conditions du stage
  workSchedule: "",
  hoursPerWeek: "",
  workLanguage: "",
  scheduleType: "TEMPS_PLEIN",
  numberOfWeeks: "",
  isPaid: false,
  hourlySalary: "",
  otherCompensation: ""
};

export default function StudentRequestForm({ student, onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(
        "/api/students/requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(form)
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de créer la demande de stage."
        );
        return;
      }

      setForm(initialForm);
      setSuccess(
        "La demande de stage a été soumise avec succès."
      );

      if (onCreated) {
        await onCreated();
      }
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Impossible de communiquer avec le serveur."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <div>
          <h2>Demande de stage en entreprise</h2>
          <p>
            Remplissez les informations du stage,
            de l’entreprise et du superviseur.
          </p>
        </div>

        <span className="statusPill">
          Étudiant
        </span>
      </div>

      <form
        className="studentForm"
        onSubmit={handleSubmit}
      >
        
     <FormSection
    title="Informations de l'étudiant"
    description="Ces informations proviennent du profil connecte."
  >
    <label className="field">
      Nom complet
      <input
        type="text"
        value={
          student
            ? `${student.firstName || ""} ${student.lastName || ""}`.trim()
            : ""
        }
        readOnly
      />
    </label>

    <label className="field">
      Courriel
      <input type="text" value={student?.email || ""} readOnly />
    </label>

    <label className="field">
      Code etudiant
      <input type="text" value={student?.studentCode || ""} readOnly />
    </label>

    <label className="field">
      Code permanent
      <input type="text" value={student?.codePermanent || ""} readOnly />
    </label>

    <label className="field">
      Programme
      <input type="text" value={student?.programme || ""} readOnly />
    </label>

    <label className="field">
      Groupe
      <input type="text" value={student?.groupe || ""} readOnly />
    </label>
    </FormSection>
        {/* SECTION 1 */}
        <FormSection
          title="1. Identification du stage"
          description="Décrivez les tâches et la période prévue du stage."
        >
          <label className="field wide">
            Résumé des tâches *

            <textarea
              name="taskSummary"
              value={form.taskSummary}
              onChange={updateField}
              rows={6}
              minLength={20}
              maxLength={3000}
              placeholder="Décrivez les principales tâches qui seront réalisées pendant le stage."
              required
            />
          </label>

          <label className="field">
            Date de début *

            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Date de fin *

            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={updateField}
              min={form.startDate || undefined}
              required
            />
          </label>
        </FormSection>

        {/* SECTION 2 */}
        <FormSection
          title="2. Identification du milieu de stage"
          description="Inscrivez les coordonnées de l’entreprise ou de l’organisme."
        >
          <label className="field">
            Nom de l’entreprise *

            <input
              type="text"
              name="companyName"
              value={form.companyName}
              onChange={updateField}
              minLength={2}
              maxLength={180}
              placeholder="Exemple : TechNova"
              required
            />
          </label>

          <label className="field">
            NEQ

            <input
              type="text"
              name="companyNeq"
              value={form.companyNeq}
              onChange={updateField}
              maxLength={30}
              placeholder="Numéro d’entreprise du Québec"
            />
          </label>

          <label className="field wide">
            Adresse *

            <input
              type="text"
              name="companyAddress"
              value={form.companyAddress}
              onChange={updateField}
              minLength={5}
              maxLength={255}
              placeholder="Numéro et nom de rue"
              required
            />
          </label>

          <label className="field">
            Ville *

            <input
              type="text"
              name="companyCity"
              value={form.companyCity}
              onChange={updateField}
              minLength={2}
              maxLength={120}
              required
            />
          </label>

          <label className="field">
            Code postal *

            <input
              type="text"
              name="companyPostalCode"
              value={form.companyPostalCode}
              onChange={updateField}
              maxLength={20}
              placeholder="A1A 1A1"
              required
            />
          </label>

          <label className="field">
            Téléphone *

            <input
              type="tel"
              name="companyPhone"
              value={form.companyPhone}
              onChange={updateField}
              maxLength={40}
              placeholder="514-555-0000"
              required
            />
          </label>

          <label className="field">
            Poste téléphonique

            <input
              type="text"
              name="companyPhoneExtension"
              value={form.companyPhoneExtension}
              onChange={updateField}
              maxLength={20}
            />
          </label>

          <label className="field">
            Courriel de l’entreprise

            <input
              type="email"
              name="companyEmail"
              value={form.companyEmail}
              onChange={updateField}
              maxLength={255}
              placeholder="contact@entreprise.ca"
            />
          </label>

          <label className="field">
            Site Internet

            <input
              type="url"
              name="companyWebsite"
              value={form.companyWebsite}
              onChange={updateField}
              maxLength={255}
              placeholder="https://entreprise.ca"
            />
          </label>

          <label className="field">
            Type d’organisation *

            <select
              name="organizationType"
              value={form.organizationType}
              onChange={updateField}
              required
            >
              <option value="PRIVE">
                Entreprise privée
              </option>

              <option value="PUBLIC">
                Organisme public
              </option>
            </select>
          </label>

          <label className="field">
            Secteur d’activité *

            <input
              type="text"
              name="businessSector"
              value={form.businessSector}
              onChange={updateField}
              maxLength={160}
              placeholder="Exemple : Technologies de l’information"
              required
            />
          </label>
        </FormSection>

        {/* SECTION 3 */}
        <FormSection
          title="3. Responsable des ressources humaines"
          description="Cette section peut être laissée vide si elle ne s’applique pas."
        >
          <label className="field">
            Nom du responsable RH

            <input
              type="text"
              name="hrName"
              value={form.hrName}
              onChange={updateField}
              maxLength={160}
            />
          </label>

          <label className="field">
            Courriel du responsable RH

            <input
              type="email"
              name="hrEmail"
              value={form.hrEmail}
              onChange={updateField}
              maxLength={255}
            />
          </label>

          <label className="field">
            Téléphone du responsable RH

            <input
              type="tel"
              name="hrPhone"
              value={form.hrPhone}
              onChange={updateField}
              maxLength={40}
            />
          </label>

          <label className="field">
            Poste

            <input
              type="text"
              name="hrExtension"
              value={form.hrExtension}
              onChange={updateField}
              maxLength={20}
            />
          </label>
        </FormSection>

        {/* SECTION 4 */}
        <FormSection
          title="4. Superviseur associé en entreprise"
          description="Indiquez la personne qui supervisera l’étudiant dans l’entreprise."
        >
          <label className="field">
            Nom du superviseur *

            <input
              type="text"
              name="supervisorName"
              value={form.supervisorName}
              onChange={updateField}
              maxLength={160}
              required
            />
          </label>

          <label className="field">
            Titre professionnel *

            <input
              type="text"
              name="supervisorTitle"
              value={form.supervisorTitle}
              onChange={updateField}
              maxLength={160}
              placeholder="Exemple : Développeur principal"
              required
            />
          </label>

          <label className="field">
            Courriel du superviseur *

            <input
              type="email"
              name="supervisorEmail"
              value={form.supervisorEmail}
              onChange={updateField}
              maxLength={255}
              required
            />
          </label>

          <label className="field">
            Téléphone du superviseur *

            <input
              type="tel"
              name="supervisorPhone"
              value={form.supervisorPhone}
              onChange={updateField}
              maxLength={40}
              required
            />
          </label>
        </FormSection>

        {/* SECTION 5 */}
        <FormSection
          title="5. Horaire et conditions du stage"
          description="Précisez l’horaire, la durée et les conditions financières."
        >
          <label className="field wide">
            Horaire de travail *

            <input
              type="text"
              name="workSchedule"
              value={form.workSchedule}
              onChange={updateField}
              maxLength={160}
              placeholder="Exemple : lundi au vendredi, de 8 h 30 à 16 h 30"
              required
            />
          </label>

          <label className="field">
            Nombre d’heures par semaine *

            <input
              type="number"
              name="hoursPerWeek"
              value={form.hoursPerWeek}
              onChange={updateField}
              min="1"
              max="80"
              step="0.5"
              required
            />
          </label>

          <label className="field">
            Nombre de semaines *

            <input
              type="number"
              name="numberOfWeeks"
              value={form.numberOfWeeks}
              onChange={updateField}
              min="1"
              max="52"
              step="0.5"
              required
            />
          </label>

          <label className="field">
            Langue de travail *

            <input
              type="text"
              name="workLanguage"
              value={form.workLanguage}
              onChange={updateField}
              maxLength={80}
              placeholder="Exemple : Français"
              required
            />
          </label>

          <label className="field">
            Type d’horaire *

            <select
              name="scheduleType"
              value={form.scheduleType}
              onChange={updateField}
              required
            >
              <option value="TEMPS_PLEIN">
                Temps plein
              </option>

              <option value="TEMPS_PARTIEL">
                Temps partiel
              </option>
            </select>
          </label>

          <label className="field checkboxField">
            <input
              type="checkbox"
              name="isPaid"
              checked={form.isPaid}
              onChange={updateField}
            />

            Stage rémunéré
          </label>

          {form.isPaid && (
            <label className="field">
              Salaire horaire *

              <input
                type="number"
                name="hourlySalary"
                value={form.hourlySalary}
                onChange={updateField}
                min="0"
                max="9999"
                step="0.01"
                placeholder="Exemple : 20.00"
                required
              />
            </label>
          )}

          <label className="field wide">
            Autre compensation

            <input
              type="text"
              name="otherCompensation"
              value={form.otherCompensation}
              onChange={updateField}
              maxLength={180}
              placeholder="Exemple : transport, repas ou stationnement"
            />
          </label>
        </FormSection>

        {error && (
          <div className="studentError">
            {error}
          </div>
        )}

        {success && (
          <div className="studentSuccess">
            {success}
          </div>
        )}

        <div className="studentFormActions">
          <button
            className="primaryButton fitButton"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Envoi en cours..."
              : "Soumettre la demande"}
          </button>
        </div>
      </form>
    </section>
  );
}

function FormSection({
  title,
  description,
  children
}) {
  return (
    <fieldset className="stageFormSection">
      <legend>{title}</legend>

      {description && (
        <p className="stageFormDescription">
          {description}
        </p>
      )}

      <div className="studentFormGrid">
        {children}
      </div>
    </fieldset>
  );
}

function validateForm(form) {
  const requiredTextFields = [
    ["Résumé des tâches", form.taskSummary],
    ["Nom de l’entreprise", form.companyName],
    ["Adresse", form.companyAddress],
    ["Ville", form.companyCity],
    ["Code postal", form.companyPostalCode],
    ["Téléphone de l’entreprise", form.companyPhone],
    ["Secteur d’activité", form.businessSector],
    ["Nom du superviseur", form.supervisorName],
    ["Titre du superviseur", form.supervisorTitle],
    ["Courriel du superviseur", form.supervisorEmail],
    ["Téléphone du superviseur", form.supervisorPhone],
    ["Horaire de travail", form.workSchedule],
    ["Langue de travail", form.workLanguage]
  ];

  for (const [label, value] of requiredTextFields) {
    if (!String(value || "").trim()) {
      return `Le champ « ${label} » est obligatoire.`;
    }
  }

  if (!form.startDate || !form.endDate) {
    return "Les dates de début et de fin sont obligatoires.";
  }

  if (form.taskSummary.trim().length < 20) {
    return "Le résumé des tâches doit contenir au moins 20 caractères.";
  }

  if (form.endDate <= form.startDate) {
    return "La date de fin doit être après la date de début.";
  }

  const hoursPerWeek = Number(form.hoursPerWeek);
  const numberOfWeeks = Number(form.numberOfWeeks);

  if (
    !Number.isFinite(hoursPerWeek) ||
    hoursPerWeek <= 0 ||
    hoursPerWeek > 80
  ) {
    return "Le nombre d’heures par semaine doit être entre 1 et 80.";
  }

  if (
    !Number.isFinite(numberOfWeeks) ||
    numberOfWeeks <= 0 ||
    numberOfWeeks > 52
  ) {
    return "Le nombre de semaines doit être entre 1 et 52.";
  }

  if (
    form.isPaid &&
    (
      form.hourlySalary === "" ||
      Number(form.hourlySalary) < 0
    )
  ) {
    return "Indiquez un salaire horaire valide.";
  }

  return "";
}