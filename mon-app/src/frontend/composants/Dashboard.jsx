import { useEffect, useState } from "react";
import Logout from "./Logout.jsx";
import "../assets/auth.css";

export default function Dashboard({ user, onLogout }) {
  const [currentUser, setCurrentUser] = useState(user);
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
          <button className="active" type="button">
            Tableau de bord
          </button>
        </nav>

        <div className="profileBox">
          <strong>{displayName(currentUser)}</strong>
          <span>{roleLabel(currentUser.role)}</span>
        </div>
      </aside>

      <main className="contentArea">
        <header className="topHeader">
          <div>
            <span className="crumb">Espace {roleLabel(currentUser.role)}</span>
            <h1>Tableau de bord</h1>
          </div>

          <Logout onLogout={onLogout} />
        </header>

        {error && <div className="error-message">{error}</div>}

        <section className="dashboardHero">
          <div>
            <h2>Bonjour, {displayName(currentUser)}</h2>
            <p>Votre session est active. Les prochains modules seront ajoutes progressivement.</p>
          </div>
          <span className="statusPill statusGreen">{currentUser.status}</span>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Profil connecte</h2>
            <span className="statusPill">{roleLabel(currentUser.role)}</span>
          </div>

          <div className="stageInfo">
            <div>
              <strong>Courriel</strong>
              <span>{currentUser.email}</span>
            </div>
            <div>
              <strong>Identifiant</strong>
              <span>{currentUser.codePermanent || currentUser.studentCode || currentUser.employeeNumber || "-"}</span>
            </div>
            <div>
              <strong>Statut</strong>
              <span>{currentUser.status}</span>
            </div>
          </div>
        </section>
      </main>
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
