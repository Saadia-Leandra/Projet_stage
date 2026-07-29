import { useState } from "react";
import Login from "../src/frontend/composants/Login.jsx";
import Dashboard from "../src/frontend/composants/Dashboard.jsx";
import { restoreAuthUser } from "./frontend/services/authSession.js";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(getSavedUser);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

function getSavedUser() {
  return restoreAuthUser();
}
