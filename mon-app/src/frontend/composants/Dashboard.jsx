import { useEffect, useState } from "react";
import Logout from "./Logout.jsx";
import HistoryDashboard from "./HistoryDashboard.jsx";
import PayrollDashboard from "./PayrollDashboard.jsx";
import StageContractsDashboard from "./StageContractsDashboard.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import StudentCsvImport from "./StudentCsvImport.jsx";
import AdminStudents from "./AdminStudents.jsx";
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
            icon="dashboard"
            onClick={() => setActiveView("dashboard")}
          />

          {currentUser.role === "ETUDIANT" && (
            <>
              <SidebarButton
                active={activeView === "requests"}
                label="Demandes de stage"
                icon="request"
                onClick={() => setActiveView("requests")}
              />
              <SidebarButton
                active={activeView === "contracts"}
                label="Contrats"
                icon="contract"
                onClick={() => setActiveView("contracts")}
              />
              <SidebarButton
                active={activeView === "history"}
                label="Historique"
                icon="history"
                onClick={() => setActiveView("history")}
              />
            </>
          )}

          {currentUser.role === "SUPERVISEUR" && (
            <>
              <SidebarButton
                active={activeView === "stageRequests"}
                label="Demandes à valider"
                icon="approval"
                onClick={() => setActiveView("stageRequests")}
              />

              <SidebarButton
                active={activeView === "stageContracts"}
                label="Contrats stage"
                icon="contract"
                onClick={() => setActiveView("stageContracts")}
              />

              <SidebarButton
                active={activeView === "mileage"}
                label="Kilométrage"
                icon="mileage"
                onClick={() => setActiveView("mileage")}
              />

              <SidebarButton
                active={activeView === "payroll"}
                label="Paie"
                icon="payroll"
                onClick={() => setActiveView("payroll")}
              />
            </>
          )}

          {["CONSEILLERE", "DIRECTION"].includes(currentUser.role) && (
            <SidebarButton
              active={activeView === "stageContracts"}
              label="Contrats stage"
              icon="contract"
              onClick={() => setActiveView("stageContracts")}
            />
          )}

          {["CONSEILLERE", "DIRECTION"].includes(currentUser.role) && (
            <SidebarButton
              active={activeView === "studentImport"}
              label="Importer des étudiants"
              icon="import"
              onClick={() => setActiveView("studentImport")}
            />
          )}

          {currentUser.role === "DIRECTION" && (
            <SidebarButton
              active={activeView === "adminStudents"}
              label="Gérer les étudiants"
              icon="students"
              onClick={() => setActiveView("adminStudents")}
            />
          )}

          {["CONSEILLERE", "COMPTABILITE", "DIRECTION"].includes(currentUser.role) && (
            <SidebarButton
              active={activeView === "payroll"}
              label="Paie superviseurs"
              icon="payroll"
              onClick={() => setActiveView("payroll")}
            />
          )}

          {["SUPERVISEUR", "CONSEILLERE", "COMPTABILITE", "DIRECTION"].includes(currentUser.role) && (
            <SidebarButton
              active={["history", "historyMileage"].includes(activeView)}
              label="Historique"
              icon="history"
              onClick={() => setActiveView("history")}
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
            <p>{pageDescription(activeView, currentUser.role)}</p>
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {activeView === "dashboard" && (
          <section className="dashboardHero">
            <div>
              <span className="heroEyebrow">Bienvenue dans votre espace</span>
              <h2>Bonjour, {displayName(currentUser)}</h2>
              <p>{heroText(currentUser.role)}</p>
            </div>
            <span className="statusPill statusGreen">{currentUser.status}</span>
          </section>
        )}

        {activeView === "studentImport" && ["CONSEILLERE", "DIRECTION"].includes(currentUser.role) ? (
          <StudentCsvImport />
        ) : ["history", "historyMileage"].includes(activeView) &&
          currentUser.role !== "ETUDIANT" ? (
          <HistoryDashboard
            user={currentUser}
            initialSection={activeView === "historyMileage" ? "mileage" : "payroll"}
          />
        ) : activeView === "adminStudents" && ["DIRECTION"].includes(currentUser.role) ? (
          <AdminStudents />
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

function SidebarButton({ active, label, icon, onClick }) {
  return (
    <button
      className={active ? "active" : ""}
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <SidebarIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function SidebarIcon({ name }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    request: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 12h6M9 16h6" />
      </>
    ),
    approval: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v5h5M9 14l2 2 4-4" />
      </>
    ),
    contract: (
      <>
        <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    mileage: (
      <>
        <path d="M5 17h14l-1.4-6.2A2.3 2.3 0 0 0 15.4 9H8.6a2.3 2.3 0 0 0-2.2 1.8z" />
        <path d="M7 17v2M17 17v2M4 13h16M8 13h.01M16 13h.01" />
      </>
    ),
    payroll: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
    import: (
      <>
        <path d="M12 3v12M8 11l4 4 4-4" />
        <path d="M5 17v3h14v-3" />
      </>
    ),
    students: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3.5 20v-2a5.5 5.5 0 0 1 11 0v2" />
        <path d="M14 14.5a4.5 4.5 0 0 1 6.5 4V20" />
      </>
    ),
    history: (
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
        <path d="M4 4v4.6h4.6M12 8v5l3 2" />
      </>
    )
  };

  return (
    <svg
      className="sideNavIcon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.dashboard}
    </svg>
  );
}

function ProfilePanel({ user }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>Profil connecté</h2>
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
    ETUDIANT: "Étudiant",
    SUPERVISEUR: "Superviseur",
    CONSEILLERE: "Conseillère",
    COMPTABILITE: "Comptabilité",
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

  return "Retrouvez les informations et les actions essentielles de votre espace.";
}

function pageTitle(view) {
  const titles = {
    dashboard: "Tableau de bord",
    requests: "Demandes de stage",
    contracts: "Contrats",
    stageContracts: "Contrats stage",
    mileage: "Kilométrage",
    stageRequests: "Demandes à valider",
    payroll: "Paie superviseurs",
    studentImport: "Importation des étudiants",
    history: "Historique",
    historyMileage: "Historique"
  };

  return titles[view] || "Tableau de bord";
}

function pageDescription(view, role) {
  if (view === "history" && role === "ETUDIANT") {
    return "Consultez vos demandes archivées et les décisions associées.";
  }

  const descriptions = {
    dashboard: heroText(role),
    requests: "Créez une demande et suivez son traitement.",
    contracts: "Consultez vos contrats et leur progression.",
    stageContracts: "Centralisez le suivi et la signature des contrats de stage.",
    mileage: "Déclarez et consultez les déplacements liés aux stages.",
    stageRequests: "Examinez les demandes et traitez les actions prioritaires.",
    payroll: "Consultez les périodes, montants et statuts de paiement.",
    studentImport: "Ajoutez plusieurs étudiants de manière contrôlée.",
    history: "Consultez les opérations de paie et de kilométrage déjà traitées.",
    historyMileage: "Consultez les opérations de paie et de kilométrage déjà traitées."
  };

  return descriptions[view] || descriptions.dashboard;
}
