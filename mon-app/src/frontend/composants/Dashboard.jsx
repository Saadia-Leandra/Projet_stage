import { useEffect, useState } from "react";
import Logout from "./Logout.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import SupervisorDashboard from "./SupervisorDashboard.jsx";
import "../assets/auth.css";

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
          localStorage.removeItem("token");
          localStorage.removeItem("user");
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
          <div className="brandMark">ST</div>
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
                active={activeView === "mileage"}
                label="Kilométrage"
                marker="KM"
                onClick={() => setActiveView("mileage")}
              />
            </>
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

        {currentUser.role === "ETUDIANT" ? (
          <StudentDashboard view={activeView} onNavigate={setActiveView} />
        ) : currentUser.role === "SUPERVISEUR" ? (
          <SupervisorDashboard
            view={activeView}
            user={currentUser}
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

  return "Votre session est active. Les prochains modules seront ajoutes progressivement.";
}

function pageTitle(view) {
  const titles = {
    dashboard: "Tableau de bord",
    requests: "Demandes de stage",
    contracts: "Contrats",
    mileage: "Kilometrage",
    stageRequests: "Demandes à valider",
  };

  return titles[view] || "Tableau de bord";
}
