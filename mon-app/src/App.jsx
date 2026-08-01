import { useState } from "react";
import Login from "../src/frontend/composants/Login.jsx";
import Dashboard from "../src/frontend/composants/Dashboard.jsx";
import FirstLoginPassword from "./frontend/composants/FirstLoginPassword.jsx";
import { clearAuthSession, restoreAuthUser } from "./frontend/services/authSession.js";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(getSavedUser);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (user.mustChangePassword) {
    return (
      <FirstLoginPassword
        user={user}
        onCompleted={setUser}
        onLogout={() => {
          clearAuthSession();
          setUser(null);
        }}
      />
    );
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

function getSavedUser() {
  return restoreAuthUser();
}
