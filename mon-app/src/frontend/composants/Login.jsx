import { useState } from "react";
import "../assets/auth.css";

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          identifier,
          password
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Connexion impossible.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
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
        <form className="authCard" onSubmit={handleSubmit} autoComplete="off">
          <h2>Connexion</h2>
          <p className="authIntro">Accédez à votre espace de gestion des stages.</p>

          <label className="field">
            Code d'identification
            <input
              type="text"
              name="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Courriel ou code permanent"
              required
            />
          </label>

          <label className="field">
            Mot de passe
            <span className="passwordRow">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                className="iconButton"
                type="button"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                <PasswordIcon visible={showPassword} />
              </button>
            </span>
          </label>

          <div className="authOptions">
            <label className="checkLabel">
              <input type="checkbox" />
              Se souvenir de moi
            </label>
            <button className="linkButton" type="button">
              Mot de passe oublié ?
            </button>
          </div>

          {error && <p className="errorText">{error}</p>}

          <button className="primaryButton" type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordIcon({ visible }) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {!visible && <path d="m4 4 16 16" />}
    </svg>
  );
}
