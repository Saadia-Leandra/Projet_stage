import { useEffect, useState } from "react";

const COMPANY_FIELDS = [
  "companyName", "companyNeq", "companyAddress", "companyCity",
  "companyProvince", "companyPostalCode", "companyPhone",
  "companyPhoneExtension", "companyEmail", "companyWebsite",
  "organizationType", "businessSector"
];

export default function CompanyAutocomplete({ form, onApply }) {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCompanyKey, setSelectedCompanyKey] = useState("");

  useEffect(() => {
    const name = form.companyName.trim();
    const address = form.companyAddress.trim();
    const currentKey = `${name.toLowerCase()}|${address.toLowerCase()}`;
    if (selectedCompanyKey && selectedCompanyKey !== currentKey) {
      setSelectedCompanyKey("");
      return undefined;
    }
    if ((name.length < 2 && address.length < 5) || selectedCompanyKey) {
      setSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ name, address });
        const response = await fetch(`/api/student/company-suggestions?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) setSuggestions(data.companies || []);
      } catch (error) {
        if (error.name !== "AbortError") setSuggestions([]);
      }
    }, 350);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [form.companyName, form.companyAddress, selectedCompanyKey]);

  if (!suggestions.length) return null;

  return <div className="companySuggestions wide" role="listbox" aria-label="Milieux de stage correspondants">
    <strong>Milieu déjà utilisé par au moins deux étudiants</strong>
    <span>Sélectionnez une correspondance pour remplir automatiquement les coordonnées.</span>
    {suggestions.map((company) => <button key={company.id} type="button" className="companySuggestion" onClick={() => {
      const values = {};
      COMPANY_FIELDS.forEach((field) => { values[field] = company[field] ?? ""; });
      setSelectedCompanyKey(`${String(company.companyName || "").trim().toLowerCase()}|${String(company.companyAddress || "").trim().toLowerCase()}`);
      setSuggestions([]);
      onApply(values);
    }}>
      <strong>{company.companyName}</strong>
      <span>{[company.companyAddress, company.companyCity, company.companyPostalCode].filter(Boolean).join(", ")}</span>
      <small>{company.studentCount} étudiants ont utilisé ce milieu</small>
    </button>)}
  </div>;
}
