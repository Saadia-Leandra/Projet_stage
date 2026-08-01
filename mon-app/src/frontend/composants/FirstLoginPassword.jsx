import { useState } from "react";
import { saveAuthSession } from "../services/authSession.js";
import "../assets/auth.css";

export default function FirstLoginPassword({ user, onCompleted, onLogout }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/auth/first-login-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password, confirmPassword })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Impossible de créer le mot de passe.");
        return;
      }

      saveAuthSession({
        token: data.token,
        user: data.user,
        rememberMe: false
      });
      onCompleted(data.user);
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <section className="brandPane">
        <div className="brandPaneContent">
          <img
            className="loginBrandMark"
            src="/institut-teccart-logo.webp"
            alt="Institut Teccart"
          />
          <h1>StageTec</h1>
          <p>Plateforme de gestion de stage</p>
        </div>
      </section>

      <section className="authPane">
        <form className="authCard" onSubmit={handleSubmit}>
          <div>
            <span className="heroEyebrow">Première connexion</span>
            <h2>Créez votre mot de passe</h2>
            <p>
              Bonjour {user.fullName}. Remplacez le mot de passe temporaire
              avant d’accéder à votre espace.
            </p>
          </div>

          <label className="field">
            Nouveau mot de passe
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="field">
            Confirmer le mot de passe
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="rememberRow">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Afficher les mots de passe
          </label>

          <small className="passwordRequirement">
            Utilisez une phrase de passe de 12 à 128 caractères.
          </small>

          {error && <div className="error-message">{error}</div>}

          <button className="primaryButton" type="submit" disabled={loading}>
            {loading ? "Création..." : "Créer mon mot de passe"}
          </button>
          <button className="authBackButton" type="button" onClick={onLogout}>
            Se déconnecter
          </button>
        </form>
      </section>
    </main>
  );
}
