import { useEffect, useState } from "react";

const emptyForm = {
  taskSummary: "",
  startDate: "",
  endDate: "",

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

  hrName: "",
  hrEmail: "",
  hrPhone: "",
  hrExtension: "",

  supervisorName: "",
  supervisorTitle: "",
  supervisorEmail: "",
  supervisorPhone: "",

  workSchedule: "",
  hoursPerWeek: "",
  workLanguage: "",
  scheduleType: "TEMPS_PLEIN",
  numberOfWeeks: "",
  isPaid: false,
  hourlySalary: "",
  otherCompensation: ""
};

export default function StudentRequestEditForm({
  request,
  onUpdated,
  onCancel
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!request) {
      return;
    }

    setForm({
      taskSummary: request.taskSummary || "",
      startDate: formatInputDate(
        request.startDate
      ),
      endDate: formatInputDate(
        request.endDate
      ),

      companyName: request.companyName || "",
      companyNeq: request.companyNeq || "",
      companyAddress:
        request.companyAddress || "",
      companyCity: request.companyCity || "",
      companyPostalCode:
        request.companyPostalCode || "",
      companyPhone:
        request.companyPhone || "",
      companyPhoneExtension:
        request.companyPhoneExtension || "",
      companyEmail:
        request.companyEmail || "",
      companyWebsite:
        request.companyWebsite || "",
      organizationType:
        request.organizationType || "PRIVE",
      businessSector:
        request.businessSector || "",

      hrName: request.hrName || "",
      hrEmail: request.hrEmail || "",
      hrPhone: request.hrPhone || "",
      hrExtension:
        request.hrExtension || "",

      supervisorName:
        request.supervisorName || "",
      supervisorTitle:
        request.supervisorTitle || "",
      supervisorEmail:
        request.supervisorEmail || "",
      supervisorPhone:
        request.supervisorPhone || "",

      workSchedule:
        request.workSchedule || "",
      hoursPerWeek:
        request.hoursPerWeek || "",
      workLanguage:
        request.workLanguage || "",
      scheduleType:
        request.scheduleType ||
        "TEMPS_PLEIN",
      numberOfWeeks:
        request.numberOfWeeks || "",
      isPaid: Boolean(request.isPaid),
      hourlySalary:
        request.hourlySalary || "",
      otherCompensation:
        request.otherCompensation || ""
    });
  }, [request]);

  function updateField(event) {
    const {
      name,
      value,
      type,
      checked
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]:
        type === "checkbox"
          ? checked
          : value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const validationError =
      validateForm(form);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `/api/students/requests/${request.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
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
            "Impossible de modifier la demande."
        );
        return;
      }

      if (onUpdated) {
        await onUpdated();
      }
    } catch (requestError) {
      console.error(requestError);

      setError(
        "Erreur de connexion au serveur."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="studentPanel">
      <div className="panelHeader">
        <h2>Modifier la demande</h2>

        <span className="statusPill">
          {request.status}
        </span>
      </div>

      {request.refusalReason && (
        <div className="studentError">
          Motif du refus :{" "}
          {request.refusalReason}
        </div>
      )}

      <form
        className="studentForm"
        onSubmit={handleSubmit}
      >
        <FormSection title="1. Identification du stage">
          <label className="field wide">
            Résumé des tâches *

            <textarea
              name="taskSummary"
              value={form.taskSummary}
              onChange={updateField}
              rows={6}
              minLength={20}
              maxLength={3000}
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

        <FormSection title="2. Entreprise">
          <label className="field">
            Nom *

            <input
              name="companyName"
              value={form.companyName}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            NEQ

            <input
              name="companyNeq"
              value={form.companyNeq}
              onChange={updateField}
            />
          </label>

          <label className="field wide">
            Adresse *

            <input
              name="companyAddress"
              value={form.companyAddress}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Ville *

            <input
              name="companyCity"
              value={form.companyCity}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Code postal *

            <input
              name="companyPostalCode"
              value={form.companyPostalCode}
              onChange={updateField}
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
              required
            />
          </label>

          <label className="field">
            Poste

            <input
              name="companyPhoneExtension"
              value={
                form.companyPhoneExtension
              }
              onChange={updateField}
            />
          </label>

          <label className="field">
            Courriel

            <input
              type="email"
              name="companyEmail"
              value={form.companyEmail}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Site Web

            <input
              type="url"
              name="companyWebsite"
              value={form.companyWebsite}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Type d’organisation *

            <select
              name="organizationType"
              value={form.organizationType}
              onChange={updateField}
            >
              <option value="PRIVE">
                Privée
              </option>

              <option value="PUBLIC">
                Publique
              </option>
            </select>
          </label>

          <label className="field">
            Secteur d’activité *

            <input
              name="businessSector"
              value={form.businessSector}
              onChange={updateField}
              required
            />
          </label>
        </FormSection>

        <FormSection title="3. Responsable RH">
          <label className="field">
            Nom

            <input
              name="hrName"
              value={form.hrName}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Courriel

            <input
              type="email"
              name="hrEmail"
              value={form.hrEmail}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Téléphone

            <input
              type="tel"
              name="hrPhone"
              value={form.hrPhone}
              onChange={updateField}
            />
          </label>

          <label className="field">
            Poste

            <input
              name="hrExtension"
              value={form.hrExtension}
              onChange={updateField}
            />
          </label>
        </FormSection>

        <FormSection title="4. Superviseur en entreprise">
          <label className="field">
            Nom *

            <input
              name="supervisorName"
              value={form.supervisorName}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Titre *

            <input
              name="supervisorTitle"
              value={form.supervisorTitle}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Courriel *

            <input
              type="email"
              name="supervisorEmail"
              value={form.supervisorEmail}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Téléphone *

            <input
              type="tel"
              name="supervisorPhone"
              value={form.supervisorPhone}
              onChange={updateField}
              required
            />
          </label>
        </FormSection>

        <FormSection title="5. Conditions du stage">
          <label className="field wide">
            Horaire *

            <input
              name="workSchedule"
              value={form.workSchedule}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Heures par semaine *

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
            Langue *

            <input
              name="workLanguage"
              value={form.workLanguage}
              onChange={updateField}
              required
            />
          </label>

          <label className="field">
            Type d’horaire *

            <select
              name="scheduleType"
              value={form.scheduleType}
              onChange={updateField}
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
                step="0.01"
                required
              />
            </label>
          )}

          <label className="field wide">
            Autre compensation

            <input
              name="otherCompensation"
              value={
                form.otherCompensation
              }
              onChange={updateField}
            />
          </label>
        </FormSection>

        {error && (
          <div className="studentError">
            {error}
          </div>
        )}

        <div className="studentFormActions">
          <button
            className="primaryButton"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Enregistrement..."
              : "Enregistrer"}
          </button>

          <button
            className="secondaryButton"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}

function FormSection({
  title,
  children
}) {
  return (
    <fieldset className="stageFormSection">
      <legend>{title}</legend>

      <div className="studentFormGrid">
        {children}
      </div>
    </fieldset>
  );
}

function validateForm(form) {
  if (
    !form.taskSummary.trim() ||
    !form.companyName.trim() ||
    !form.companyAddress.trim() ||
    !form.companyCity.trim() ||
    !form.companyPostalCode.trim() ||
    !form.companyPhone.trim() ||
    !form.businessSector.trim() ||
    !form.supervisorName.trim() ||
    !form.supervisorTitle.trim() ||
    !form.supervisorEmail.trim() ||
    !form.supervisorPhone.trim() ||
    !form.workSchedule.trim() ||
    !form.workLanguage.trim() ||
    !form.startDate ||
    !form.endDate
  ) {
    return "Tous les champs obligatoires doivent être remplis.";
  }

  if (form.taskSummary.trim().length < 20) {
    return "Le résumé doit contenir au moins 20 caractères.";
  }

  if (form.endDate <= form.startDate) {
    return "La date de fin doit être après la date de début.";
  }

  if (
    Number(form.hoursPerWeek) <= 0 ||
    Number(form.hoursPerWeek) > 80
  ) {
    return "Le nombre d’heures est invalide.";
  }

  if (
    Number(form.numberOfWeeks) <= 0 ||
    Number(form.numberOfWeeks) > 52
  ) {
    return "Le nombre de semaines est invalide.";
  }

  if (
    form.isPaid &&
    form.hourlySalary === ""
  ) {
    return "Le salaire horaire est obligatoire.";
  }

  return "";
}

function formatInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}