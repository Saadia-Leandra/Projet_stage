import { useEffect, useState } from "react";
import Logout from "./Logout.jsx";
import PayrollDashboard from "./PayrollDashboard.jsx";
import StageContractsDashboard from "./StageContractsDashboard.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import StudentCsvImport from "./StudentCsvImport.jsx";
import SupervisorDashboard from "./SupervisorDashboard.jsx";
import "../assets/auth.css";
import { clearAuthSession } from "../services/authSession.js";

export default function Dashboard({ user, onLogout }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [activeView, setActiveView] = useState("dashboard");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("token");

      if (!token) {
        onLogout();
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          clearAuthSession();
          onLogout();
          return;
        }

        setCurrentUser(data.user || null);
      } catch {
        setError("Impossible de charger le profil.");
      }
    }

    loadUser();
  }, [onLogout]);

  if (!currentUser) {
    return null;
  }

  return (
    <section className="appLayout">
      <aside className="sidebar">
        <div className="sidebarBrand">
          <div className="brandMark">
            <img src="/institut-teccart-logo.webp" alt="Institut Teccart" />
          </div>
          <div>
            <strong>StageTec</strong>
            <span>Gestion des stages</span>
          </div>
        </div>

        <nav className="sideNav">
          <SidebarButton
            active={activeView === "dashboard"}
            label="Tableau de bord"
            marker="DB"
            onClick={() => setActiveView("dashboard")}
          />

          {currentUser.role === "ETUDIANT" && (
            <>
              <SidebarButton
                active={activeView === "requests"}
                label="Demandes de stage"
                marker="DS"
                onClick={() => setActiveView("requests")}
              />
              <SidebarButton
                active={activeView === "contracts"}
                label="Contrats"
                marker="CT"
                onClick={() => setActiveView("contracts")}
              />
            </>
          )}

          {currentUser.role === "SUPERVISEUR" && (
            <>
              <SidebarButton
                active={activeView === "stageRequests"}
                label="Demandes à valider"
                marker="DV"
                onClick={() => setActiveView("stageRequests")}
              />

              <SidebarButton
                active={activeView === "stageContracts"}
                label="Contrats stage"
                marker="CS"
                onClick={() => setActiveView("stageContracts")}
              />

              <SidebarButton
                active={activeView === "mileage"}
                label="Kilométrage"
                marker="KM"
                onClick={() => setActiveView("mileage")}
              />

              <SidebarButton
                active={activeView === "payroll"}
                label="Paie"
                marker="PA"
                onClick={() => setActiveView("payroll")}
              />
            </>
          )}

          {["CONSEILLERE", "DIRECTION"].includes(currentUser.role) && (
            <SidebarButton
              active={activeView === "stageContracts"}
              label="Contrats stage"
              marker="CS"
              onClick={() => setActiveView("stageContracts")}
            />
          )}

          {currentUser.role === "CONSEILLERE" && (
            <SidebarButton
              active={activeView === "studentImport"}
              label="Importer des etudiants"
              marker="CSV"
              onClick={() => setActiveView("studentImport")}
            />
          )}

          {["CONSEILLERE", "COMPTABILITE", "DIRECTION"].includes(currentUser.role) && (
            <SidebarButton
              active={activeView === "payroll"}
              label="Paie superviseurs"
              marker="PA"
              onClick={() => setActiveView("payroll")}
            />
          )}
        </nav>

        <div className="profileBox">
          <div className="profileInitial">{displayName(currentUser).charAt(0).toUpperCase()}</div>
          <div>
            <strong>{displayName(currentUser)}</strong>
            <span>{roleLabel(currentUser.role)}</span>
          </div>
          <Logout onLogout={onLogout} />
        </div>
      </aside>

      <main className="contentArea">
        <header className="topHeader">
          <div>
            <span className="crumb">Espace {roleLabel(currentUser.role)}</span>
            <h1>{pageTitle(activeView)}</h1>
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        <section className="dashboardHero">
          <div>
            <h2>Bonjour, {displayName(currentUser)}</h2>
            <p>{heroText(currentUser.role)}</p>
          </div>
          <span className="statusPill statusGreen">{currentUser.status}</span>
        </section>

        {activeView === "studentImport" && currentUser.role === "CONSEILLERE" ? (
          <StudentCsvImport />
        ) : activeView === "stageContracts" ? (
          <StageContractsDashboard user={currentUser} />
        ) : activeView === "payroll" ? (
          <PayrollDashboard user={currentUser} />
        ) : currentUser.role === "ETUDIANT" ? (
          <StudentDashboard view={activeView} onNavigate={setActiveView} />
        ) : currentUser.role === "SUPERVISEUR" ? (
          <SupervisorDashboard
            view={activeView}
            user={currentUser}
            onNavigate={setActiveView}
          />
        ) : (
          <ProfilePanel user={currentUser} />
        )}
      </main>
    </section>
  );
}

function SidebarButton({ active, label, marker, onClick }) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      <span className="sideNavMarker">{marker}</span>
      <span>{label}</span>
      {active && <span className="sideNavArrow">&gt;</span>}
    </button>
  );
}

function ProfilePanel({ user }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Profil connecte</h2>
        <span className="statusPill">{roleLabel(user.role)}</span>
      </div>

      <div className="stageInfo">
        <div>
          <strong>Courriel</strong>
          <span>{user.email}</span>
        </div>
        <div>
          <strong>Identifiant</strong>
          <span>{user.codePermanent || user.studentCode || user.employeeNumber || "-"}</span>
        </div>
        <div>
          <strong>Statut</strong>
          <span>{user.status}</span>
        </div>
      </div>
    </section>
  );
}

function roleLabel(role) {
  const labels = {
    ETUDIANT: "Etudiant",
    SUPERVISEUR: "Superviseur",
    CONSEILLERE: "Conseillere",
    COMPTABILITE: "Comptabilite",
    DIRECTION: "Direction"
  };

  return labels[role] || role;
}

function displayName(user) {
  return user.fullName || user.email?.split("@")[0] || "Utilisateur";
}

function heroText(role) {
  if (role === "ETUDIANT") {
    return "Consultez votre dossier et soumettez vos demandes de stage.";
  }

  if (role === "SUPERVISEUR") {
    return "Consultez les demandes de stage et les informations de kilométrage.";
  }

  return "Votre session est active. Les prochains modules seront ajoutes progressivement.";
}

function pageTitle(view) {
  const titles = {
    dashboard: "Tableau de bord",
    requests: "Demandes de stage",
    contracts: "Contrats",
    stageContracts: "Contrats stage",
    mileage: "Kilometrage",
    stageRequests: "Demandes à valider",
    payroll: "Paie superviseurs"
    ,
    studentImport: "Importation des etudiants"
  };

  return titles[view] || "Tableau de bord";
}
