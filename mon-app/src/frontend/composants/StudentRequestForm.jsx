import { useEffect, useState } from "react";

import CityInput from "./CityInput.jsx";
import ProvinceInput from "./ProvinceInput.jsx";

const initialForm = {
  // Informations de l'etudiant
  studentPhone: "",
  studentAddress: "",
  studentCity: "",
  studentProvince: "",
  studentPostalCode: "",
  expirationCaq: "",
  expirationStudyPermit: "",
  expirationInsurance: "",

  // Identification du stage
  taskSummary: "",
  startDate: "",
  endDate: "",

  // Entreprise
  companyName: "",
  companyNeq: "",
  companyAddress: "",
  companyCity: "",
  companyProvince: "",
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
  const [form, setForm] = useState(() => ({
    ...initialForm,
    ...studentProfileDefaults(student)
  }));
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const defaults = studentProfileDefaults(student);

    setForm((currentForm) => ({
      ...currentForm,
      studentPhone:
        currentForm.studentPhone || defaults.studentPhone,
      studentAddress:
        currentForm.studentAddress ||
        defaults.studentAddress,
      studentCity:
        currentForm.studentCity || defaults.studentCity,
      studentProvince:
        currentForm.studentProvince ||
        defaults.studentProvince,
      studentPostalCode:
        currentForm.studentPostalCode ||
        defaults.studentPostalCode,
      expirationCaq:
        currentForm.expirationCaq ||
        defaults.expirationCaq,
      expirationStudyPermit:
        currentForm.expirationStudyPermit ||
        defaults.expirationStudyPermit,
      expirationInsurance:
        currentForm.expirationInsurance ||
        defaults.expirationInsurance
    }));
  }, [student]);

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === "checkbox" ? checked : value
    }));

    setFieldErrors((currentErrors) => {
      if (!currentErrors[name]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[name];
      return nextErrors;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationErrors = validateForm(form);

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setError(
        "Veuillez corriger les champs indiques."
      );
      return;
    }

    setFieldErrors({});

    const confirmed = window.confirm(
      "Soumettre cette demande de stage pour revision ?"
    );

    if (!confirmed) {
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
        setFieldErrors(data.fieldErrors || {});
        setError(
          data.error ||
            "Impossible de créer la demande de stage."
        );
        return;
      }

      setForm({
        ...initialForm,
        ...studentProfileDefaults(student)
      });
      setFieldErrors({});
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
        noValidate
      >
        <p className="requiredHint">* Champ obligatoire</p>

     <FormSection
    title="Informations de l'étudiant"
    description="Completez les coordonnees qui seront reprises dans la demande officielle."
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

    <label className="field">
      Telephone *
      <input
        type="tel"
        name="studentPhone"
        value={form.studentPhone}
        onChange={updateField}
        maxLength={40}
        aria-invalid={Boolean(
          fieldErrors.studentPhone
        )}
        required
      />
      <FieldError
        message={fieldErrors.studentPhone}
      />
    </label>

    <label className="field wide">
      Adresse *
      <input
        type="text"
        name="studentAddress"
        value={form.studentAddress}
        onChange={updateField}
        maxLength={255}
        aria-invalid={Boolean(
          fieldErrors.studentAddress
        )}
        required
      />
      <FieldError
        message={fieldErrors.studentAddress}
      />
    </label>

    <label className="field">
      Ville *
      <CityInput
        type="text"
        name="studentCity"
        value={form.studentCity}
        onChange={updateField}
        maxLength={120}
        aria-invalid={Boolean(
          fieldErrors.studentCity
        )}
        required
      />
      <FieldError
        message={fieldErrors.studentCity}
      />
    </label>

    <label className="field">
      Province *
      <ProvinceInput
        type="text"
        name="studentProvince"
        value={form.studentProvince}
        onChange={updateField}
        maxLength={120}
        aria-invalid={Boolean(
          fieldErrors.studentProvince
        )}
        required
      />
      <FieldError
        message={fieldErrors.studentProvince}
      />
    </label>

    <label className="field">
      Code postal *
      <input
        type="text"
        name="studentPostalCode"
        value={form.studentPostalCode}
        onChange={updateField}
        maxLength={20}
        aria-invalid={Boolean(
          fieldErrors.studentPostalCode
        )}
        required
      />
      <FieldError
        message={
          fieldErrors.studentPostalCode
        }
      />
    </label>

    <label className="field">
      Expiration CAQ
      <input
        type="date"
        name="expirationCaq"
        value={form.expirationCaq}
        onChange={updateField}
      />
    </label>

    <label className="field">
      Expiration permis d'etudes
      <input
        type="date"
        name="expirationStudyPermit"
        value={form.expirationStudyPermit}
        onChange={updateField}
      />
    </label>

    <label className="field">
      Expiration assurance
      <input
        type="date"
        name="expirationInsurance"
        value={form.expirationInsurance}
        onChange={updateField}
      />
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
              aria-invalid={Boolean(
                fieldErrors.taskSummary
              )}
              required
            />
            <FieldError
              message={fieldErrors.taskSummary}
            />
          </label>

          <label className="field">
            Date de début *

            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={updateField}
              aria-invalid={Boolean(
                fieldErrors.startDate
              )}
              required
            />
            <FieldError
              message={fieldErrors.startDate}
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
              aria-invalid={Boolean(
                fieldErrors.endDate
              )}
              required
            />
            <FieldError
              message={fieldErrors.endDate}
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
              aria-invalid={Boolean(
                fieldErrors.companyName
              )}
              required
            />
            <FieldError
              message={fieldErrors.companyName}
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
              aria-invalid={Boolean(
                fieldErrors.companyAddress
              )}
              required
            />
            <FieldError
              message={fieldErrors.companyAddress}
            />
          </label>

          <label className="field">
            Ville *

            <CityInput
              type="text"
              name="companyCity"
              value={form.companyCity}
              onChange={updateField}
              minLength={2}
              maxLength={120}
              aria-invalid={Boolean(
                fieldErrors.companyCity
              )}
              required
            />
            <FieldError
              message={fieldErrors.companyCity}
            />
          </label>

          <label className="field">
            Province *

            <ProvinceInput
              type="text"
              name="companyProvince"
              value={form.companyProvince}
              onChange={updateField}
              minLength={2}
              maxLength={120}
              aria-invalid={Boolean(
                fieldErrors.companyProvince
              )}
              required
            />
            <FieldError
              message={fieldErrors.companyProvince}
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
              aria-invalid={Boolean(
                fieldErrors.companyPostalCode
              )}
              required
            />
            <FieldError
              message={
                fieldErrors.companyPostalCode
              }
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
              aria-invalid={Boolean(
                fieldErrors.companyPhone
              )}
              required
            />
            <FieldError
              message={fieldErrors.companyPhone}
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
              aria-invalid={Boolean(
                fieldErrors.businessSector
              )}
              required
            />
            <FieldError
              message={fieldErrors.businessSector}
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
            Poste telephonique

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
              aria-invalid={Boolean(
                fieldErrors.supervisorName
              )}
              required
            />
            <FieldError
              message={fieldErrors.supervisorName}
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
              aria-invalid={Boolean(
                fieldErrors.supervisorTitle
              )}
              required
            />
            <FieldError
              message={fieldErrors.supervisorTitle}
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
              aria-invalid={Boolean(
                fieldErrors.supervisorEmail
              )}
              required
            />
            <FieldError
              message={fieldErrors.supervisorEmail}
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
              aria-invalid={Boolean(
                fieldErrors.supervisorPhone
              )}
              required
            />
            <FieldError
              message={fieldErrors.supervisorPhone}
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
              aria-invalid={Boolean(
                fieldErrors.workSchedule
              )}
              required
            />
            <FieldError
              message={fieldErrors.workSchedule}
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
              aria-invalid={Boolean(
                fieldErrors.hoursPerWeek
              )}
              required
            />
            <FieldError
              message={fieldErrors.hoursPerWeek}
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
              aria-invalid={Boolean(
                fieldErrors.numberOfWeeks
              )}
              required
            />
            <FieldError
              message={fieldErrors.numberOfWeeks}
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
              aria-invalid={Boolean(
                fieldErrors.workLanguage
              )}
              required
            />
            <FieldError
              message={fieldErrors.workLanguage}
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
                aria-invalid={Boolean(
                  fieldErrors.hourlySalary
                )}
                required
              />
              <FieldError
                message={fieldErrors.hourlySalary}
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

function FieldError({ message }) {
  if (!message) {
    return null;
  }

  return (
    <small className="fieldError">
      {message}
    </small>
  );
}

function studentProfileDefaults(student) {
  return {
    studentPhone: student?.phone || "",
    studentAddress: student?.address || "",
    studentCity: student?.city || "",
    studentProvince: student?.province || "",
    studentPostalCode: student?.postalCode || "",
    expirationCaq: formatInputDate(
      student?.expirationCaq
    ),
    expirationStudyPermit: formatInputDate(
      student?.expirationStudyPermit
    ),
    expirationInsurance: formatInputDate(
      student?.expirationInsurance
    )
  };
}

function validateForm(form) {
  const errors = {};
  const requiredTextFields = [
    ["studentPhone", "Telephone etudiant", form.studentPhone],
    ["studentAddress", "Adresse de l'etudiant", form.studentAddress],
    ["studentCity", "Ville de l'etudiant", form.studentCity],
    ["studentProvince", "Province de l'etudiant", form.studentProvince],
    ["studentPostalCode", "Code postal de l'etudiant", form.studentPostalCode],
    ["taskSummary", "Resume des taches", form.taskSummary],
    ["companyName", "Nom de l'entreprise", form.companyName],
    ["companyAddress", "Adresse", form.companyAddress],
    ["companyCity", "Ville", form.companyCity],
    ["companyProvince", "Province", form.companyProvince],
    ["companyPostalCode", "Code postal", form.companyPostalCode],
    ["companyPhone", "Telephone de l'entreprise", form.companyPhone],
    ["businessSector", "Secteur d'activite", form.businessSector],
    ["supervisorName", "Nom du superviseur", form.supervisorName],
    ["supervisorTitle", "Titre du superviseur", form.supervisorTitle],
    ["supervisorEmail", "Courriel du superviseur", form.supervisorEmail],
    ["supervisorPhone", "Telephone du superviseur", form.supervisorPhone],
    ["workSchedule", "Horaire de travail", form.workSchedule],
    ["workLanguage", "Langue de travail", form.workLanguage]
  ];

  for (const [key, label, value] of requiredTextFields) {
    if (!String(value || "").trim()) {
      errors[key] = `Le champ ${label} est obligatoire.`;
    }
  }

  if (!form.startDate) {
    errors.startDate = "La date de debut est obligatoire.";
  }

  if (!form.endDate) {
    errors.endDate = "La date de fin est obligatoire.";
  }

  if (form.taskSummary.trim().length < 20) {
    errors.taskSummary =
      "Le resume des taches doit contenir au moins 20 caracteres.";
  }

  if (
    form.startDate &&
    form.endDate &&
    form.endDate <= form.startDate
  ) {
    errors.endDate =
      "La date de fin doit etre apres la date de debut.";
  }

  const hoursPerWeek = Number(form.hoursPerWeek);
  const numberOfWeeks = Number(form.numberOfWeeks);

  if (
    !Number.isFinite(hoursPerWeek) ||
    hoursPerWeek <= 0 ||
    hoursPerWeek > 80
  ) {
    errors.hoursPerWeek =
      "Le nombre d'heures par semaine doit etre entre 1 et 80.";
  }

  if (
    !Number.isFinite(numberOfWeeks) ||
    numberOfWeeks <= 0 ||
    numberOfWeeks > 52
  ) {
    errors.numberOfWeeks =
      "Le nombre de semaines doit etre entre 1 et 52.";
  }

  if (
    form.isPaid &&
    (
      form.hourlySalary === "" ||
      Number(form.hourlySalary) < 0
    )
  ) {
    errors.hourlySalary =
      "Indiquez un salaire horaire valide.";
  }

  return errors;
}

function formatInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}
