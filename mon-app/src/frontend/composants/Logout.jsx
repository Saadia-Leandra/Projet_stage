export default function Logout({ onLogout }) {
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    onLogout();
  }

  return (
    <button className="logout-button" type="button" onClick={handleLogout}>
      Deconnexion
    </button>
  );
}
