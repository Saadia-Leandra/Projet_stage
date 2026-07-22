import {
  useCallback,
  useEffect,
  useState
} from "react";

import CityInput from "./CityInput.jsx";
import ProvinceInput from "./ProvinceInput.jsx";

const documentOptions = [
  ["ATTESTATION", "Attestation"],
  ["CAQ", "CAQ"],
  ["PERMIS_ETUDES", "Permis d'etudes"],
  ["ASSURANCE", "Assurance"],
  ["PIECE_IDENTITE", "Piece d'identite"],
  ["CV", "CV"],
  ["AUTRE", "Autre document"]
];

const emptyForm = {
  studentPhone: "",
  studentAddress: "",
  studentCity: "",
  studentProvince: "",
  studentPostalCode: "",
  expirationCaq: "",
  expirationStudyPermit: "",
  expirationInsurance: "",

  taskSummary: "",
  startDate: "",
  endDate: "",

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!request) {
      return;
    }

    setForm({
      studentPhone:
        request.studentPhone || "",
      studentAddress:
        request.studentAddress || "",
      studentCity:
        request.studentCity || "",
      studentProvince:
        request.studentProvince || "",
      studentPostalCode:
        request.studentPostalCode || "",
      expirationCaq: formatInputDate(
        request.expirationCaq
      ),
      expirationStudyPermit:
        formatInputDate(
          request.expirationStudyPermit
        ),
      expirationInsurance:
        formatInputDate(
          request.expirationInsurance
        ),

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
      companyProvince:
        request.companyProvince || "",
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

    const validationErrors =
      validateForm(form);

    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setError(
        "Veuillez corriger les champs indiques."
      );
      return;
    }

    setFieldErrors({});

    const confirmed = window.confirm(
      "Resoumettre cette demande modifiee pour revision ?"
    );

    if (!confirmed) {
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
        setFieldErrors(data.fieldErrors || {});
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

        <span
          className={`statusPill ${statusClass(
            request.status
          )}`}
        >
          {statusLabel(request.status)}
        </span>
      </div>

      {isCorrectionStatus(request.status) && (
        <div className="studentError">
          <strong>Correction demandee :</strong>{" "}
          {request.correctionStudentComment ||
            request.correctionReason}
          <div className="correctionMeta">
            <span>
              Demandee le{" "}
              {formatDateTime(
                request.correctionRequestedAt
              )}
            </span>
            <span>
              Par{" "}
              {request.correctionRequestedByLabel ||
                request.correctionRequestedByRole ||
                "superviseur"}
            </span>
          </div>
        </div>
      )}

      {request.correctionReason && (
        <div className="notice">
          <strong>Elements a corriger :</strong>{" "}
          {request.correctionItems || "-"}
          <br />
          <strong>Documents demandes :</strong>{" "}
          {formatDocumentTypes(
            request.correctionMissingDocuments
          )}
        </div>
      )}

      {request.refusalReason && (
        <div className="studentError">
          Motif du refus definitif :{" "}
          {request.refusalReason}
        </div>
      )}

      {isCorrectionStatus(request.status) && (
        <StudentRequestDocuments
          request={request}
        />
      )}

      <form
        className="studentForm"
        onSubmit={handleSubmit}
        noValidate
      >
        <p className="requiredHint">* Champ obligatoire</p>

        <FormSection title="Informations de l'etudiant">
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
              message={fieldErrors.studentPostalCode}
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
              name="companyCity"
              value={form.companyCity}
              onChange={updateField}
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
              name="companyProvince"
              value={form.companyProvince}
              onChange={updateField}
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
              name="companyPostalCode"
              value={form.companyPostalCode}
              onChange={updateField}
              aria-invalid={Boolean(
                fieldErrors.companyPostalCode
              )}
              required
            />
            <FieldError
              message={fieldErrors.companyPostalCode}
            />
          </label>

          <label className="field">
            Téléphone *

            <input
              type="tel"
              name="companyPhone"
              value={form.companyPhone}
              onChange={updateField}
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
            Numero de poste

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
            Numero de poste

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

function StudentRequestDocuments({ request }) {
  const [documents, setDocuments] = useState([]);
  const [documentType, setDocumentType] = useState(
    request.correctionMissingDocuments?.[0] || "AUTRE"
  );
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDocumentType(
      request.correctionMissingDocuments?.[0] ||
        "AUTRE"
    );
  }, [request.correctionMissingDocuments]);

  const loadDocuments = useCallback(async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `/api/students/requests/${request.id}/documents`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await response
        .json()
        .catch(() => ({}));

      if (response.ok) {
        setDocuments(data.documents || []);
      }
    } catch (requestError) {
      console.error(requestError);
    }
  }, [request.id]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function uploadDocument(event) {
    event.preventDefault();

    if (!file) {
      setError("Selectionnez un fichier.");
      return;
    }

    const token = localStorage.getItem("token");
    const formData = new FormData();

    formData.append("documentType", documentType);
    formData.append("file", file);

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/students/requests/${request.id}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        }
      );
      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de deposer le document."
        );
        return;
      }

      setMessage("Document depose.");
      setFile(null);
      await loadDocuments();
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteDocument(documentId) {
    const confirmed = window.confirm(
      "Retirer ce document avant resoumission ?"
    );

    if (!confirmed) {
      return;
    }

    const token = localStorage.getItem("token");

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/students/requests/${request.id}/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            "Impossible de retirer le document."
        );
        return;
      }

      setMessage("Document retire.");
      await loadDocuments();
    } catch (requestError) {
      console.error(requestError);
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadDocument(documentId) {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `/api/students/requests/${request.id}/documents/${documentId}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `document-${documentId}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      console.error(requestError);
    }
  }

  return (
    <div className="documentPanel">
      <div className="panelHeader">
        <div>
          <h2>Documents demandes</h2>
          <p>
            Formats acceptes : PDF, JPG ou PNG. Taille
            maximale : 10 Mo.
          </p>
        </div>

        <span className="statusPill">
          {documents.length} document(s)
        </span>
      </div>

      <form
        className="studentForm"
        onSubmit={uploadDocument}
      >
        <div className="studentFormGrid">
          <label className="field">
            Type de document
            <select
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value)
              }
            >
              {documentOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field wide">
            Fichier
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) =>
                setFile(event.target.files?.[0] || null)
              }
            />
            <small className="fieldHelp">
              Le nouveau depot remplace proprement
              l'ancienne version du meme type.
            </small>
          </label>
        </div>

        {error && (
          <div className="studentError">
            {error}
          </div>
        )}

        {message && (
          <div className="studentSuccess">
            {message}
          </div>
        )}

        <div className="studentFormActions">
          <button
            className="primaryButton fitButton"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Depot en cours..."
              : "Deposer ou remplacer"}
          </button>
        </div>
      </form>

      <div className="studentTableWrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Fichier</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>
                  {documentTypeLabel(document.type)}
                </td>
                <td>
                  <span className="tablePrimaryText">
                    {document.fileName}
                  </span>
                  <small>
                    Version {document.version}
                  </small>
                </td>
                <td>
                  {formatDateTime(document.uploadedAt)}
                </td>
                <td>
                  <div className="requestActions">
                    <button
                      className="secondaryButton"
                      type="button"
                      onClick={() =>
                        downloadDocument(document.id)
                      }
                    >
                      Telecharger
                    </button>

                    <button
                      className="dangerButton"
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        deleteDocument(document.id)
                      }
                    >
                      Retirer
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!documents.length && (
              <tr>
                <td colSpan="4">
                  <div className="emptyState">
                    Aucun document depose pour le moment.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isCorrectionStatus(status) {
  return [
    "A_REVISER",
    "DOCUMENTS_MANQUANTS"
  ].includes(status);
}

function statusLabel(status) {
  const labels = {
    SOUMISE: "A traiter",
    A_REVISER: "A corriger",
    DOCUMENTS_MANQUANTS: "Documents manquants",
    APPROUVEE: "Approuvee",
    REFUSEE: "Refus definitif",
    ANNULEE: "Annulee"
  };

  return labels[status] || status || "-";
}

function statusClass(status) {
  if (status === "APPROUVEE") {
    return "statusGreen";
  }

  if (status === "REFUSEE") {
    return "statusRed";
  }

  if (
    status === "A_REVISER" ||
    status === "DOCUMENTS_MANQUANTS"
  ) {
    return "statusYellow";
  }

  return "statusOrange";
}

function documentTypeLabel(type) {
  const labels = {
    ATTESTATION: "Attestation",
    CAQ: "CAQ",
    PERMIS_ETUDES: "Permis d'etudes",
    ASSURANCE: "Assurance",
    PIECE_IDENTITE: "Piece d'identite",
    CV: "CV",
    AUTRE: "Autre document"
  };

  return labels[type] || type || "-";
}

function formatDocumentTypes(types) {
  if (!types?.length) {
    return "-";
  }

  return types.map(documentTypeLabel).join(", ");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("fr-CA", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function validateForm(form) {
  const errors = {};
  const requiredFields = [
    ["studentPhone", "Telephone etudiant", form.studentPhone],
    ["studentAddress", "Adresse etudiant", form.studentAddress],
    ["studentCity", "Ville etudiant", form.studentCity],
    ["studentProvince", "Province etudiant", form.studentProvince],
    ["studentPostalCode", "Code postal etudiant", form.studentPostalCode],
    ["taskSummary", "Resume des taches", form.taskSummary],
    ["companyName", "Nom de l'entreprise", form.companyName],
    ["companyAddress", "Adresse entreprise", form.companyAddress],
    ["companyCity", "Ville entreprise", form.companyCity],
    ["companyProvince", "Province entreprise", form.companyProvince],
    ["companyPostalCode", "Code postal entreprise", form.companyPostalCode],
    ["companyPhone", "Telephone entreprise", form.companyPhone],
    ["businessSector", "Secteur d'activite", form.businessSector],
    ["supervisorName", "Nom du superviseur", form.supervisorName],
    ["supervisorTitle", "Titre du superviseur", form.supervisorTitle],
    ["supervisorEmail", "Courriel du superviseur", form.supervisorEmail],
    ["supervisorPhone", "Telephone du superviseur", form.supervisorPhone],
    ["workSchedule", "Horaire", form.workSchedule],
    ["workLanguage", "Langue", form.workLanguage],
    ["startDate", "Date de debut", form.startDate],
    ["endDate", "Date de fin", form.endDate]
  ];

  for (const [key, label, value] of requiredFields) {
    if (!String(value || "").trim()) {
      errors[key] = `Le champ ${label} est obligatoire.`;
    }
  }

  if (form.taskSummary.trim().length < 20) {
    errors.taskSummary =
      "Le resume doit contenir au moins 20 caracteres.";
  }

  if (form.endDate <= form.startDate) {
    errors.endDate =
      "La date de fin doit etre apres la date de debut.";
  }

  if (
    Number(form.hoursPerWeek) <= 0 ||
    Number(form.hoursPerWeek) > 80
  ) {
    errors.hoursPerWeek =
      "Le nombre d'heures est invalide.";
  }

  if (
    Number(form.numberOfWeeks) <= 0 ||
    Number(form.numberOfWeeks) > 52
  ) {
    errors.numberOfWeeks =
      "Le nombre de semaines est invalide.";
  }

  if (
    form.isPaid &&
    form.hourlySalary === ""
  ) {
    errors.hourlySalary =
      "Le salaire horaire est obligatoire.";
  }

  return errors;
}

function formatInputDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}
