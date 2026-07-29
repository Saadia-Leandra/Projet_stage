import { clearAuthSession } from "../services/authSession.js";

export default function Logout({ onLogout }) {
  function handleLogout() {
    clearAuthSession();
    onLogout();
  }

  return (
    <button className="logout-button" type="button" onClick={handleLogout}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
      </svg>
      <span>Déconnexion</span>
    </button>
  );
}
