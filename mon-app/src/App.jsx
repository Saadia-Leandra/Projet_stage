import { useState } from "react";
import Login from "../src/frontend/composants/Login.jsx";
import Dashboard from "../src/frontend/composants/Dashboard.jsx";

export default function App() {
  const [user, setUser] = useState(getSavedUser);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

function getSavedUser() {
  const savedUser = localStorage.getItem("user");

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return null;
  }
}
