import { useState } from "react";
import PayrollDashboard from "./PayrollDashboard.jsx";

export default function HistoryDashboard({ user, initialSection = "payroll" }) {
  const [section, setSection] = useState(initialSection);

  return (
    <>
      <div className="historyTabs" role="tablist" aria-label="Type d’historique">
        <button
          className={section === "payroll" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={section === "payroll"}
          onClick={() => setSection("payroll")}
        >
          Historique de paie
        </button>
        <button
          className={section === "mileage" ? "active" : ""}
          type="button"
          role="tab"
          aria-selected={section === "mileage"}
          onClick={() => setSection("mileage")}
        >
          Historique du kilométrage
        </button>
      </div>

      <PayrollDashboard user={user} mode="history" historyType={section} />
    </>
  );
}
