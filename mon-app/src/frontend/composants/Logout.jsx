import { clearAuthSession } from "../services/authSession.js";

export default function Logout({ onLogout }) {
  function handleLogout() {
    clearAuthSession();
    onLogout();
  }

  return (
    <button className="logout-button" type="button" onClick={handleLogout}>
      Deconnexion
    </button>
  );
}
