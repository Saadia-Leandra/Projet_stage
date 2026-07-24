import { useMemo, useState } from "react";
import { saveAuthSession } from "../services/authSession.js";
import "../assets/auth.css";

export default function Login({ onLogin }) {
  const resetToken = useMemo(
    () => new URLSearchParams(window.location.search).get("resetToken"),
    []
  );
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [debugResetUrl, setDebugResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    startRequest();

    try {
      const response = await postJson("/api/auth/login", {
        identifier,
        password,
        rememberMe
      });

      if (!response.ok) {
        setError(response.data.error || "Connexion impossible.");
        return;
      }

      saveAuthSession({
        token: response.data.token,
        user: response.data.user,
        rememberMe
      });
      onLogin(response.data.user);
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    startRequest();

    try {
      const response = await postJson("/api/auth/forgot-password", { email });

      if (!response.ok) {
        setError(response.data.error || "Impossible de traiter la demande.");
        return;
      }

      setNotice(response.data.message);
      setDebugResetUrl(response.data.debugResetUrl || "");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    startRequest();

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      const response = await postJson("/api/auth/reset-password", {
        token: resetToken,
        password
      });

      if (!response.ok) {
        setError(response.data.error || "Impossible de modifier le mot de passe.");
        return;
      }

      window.history.replaceState({}, "", window.location.pathname);
      setPassword("");
      setConfirmPassword("");
      setMode("login");
      setNotice(response.data.message);
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  function startRequest() {
    setError("");
    setNotice("");
    setDebugResetUrl("");
    setLoading(true);
  }

  function showMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setDebugResetUrl("");
    setPassword("");
    setConfirmPassword("");
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
        {mode === "login" && (
          <form className="authCard" onSubmit={handleLogin}>
            <AuthHeader
              title="Connexion"
              intro="Accédez à votre espace de gestion des stages."
            />

            <label className="field">
              Code d’identification
              <input
                autoComplete="username"
                name="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Courriel ou code permanent"
                required
              />
            </label>

            <PasswordField
              label="Mot de passe"
              name="password"
              value={password}
              showPassword={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="current-password"
            />

            <div className="authOptions">
              <label className="checkLabel">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Se souvenir de moi
              </label>
              <button className="linkButton" type="button" onClick={() => showMode("forgot")}>
                Mot de passe oublié ?
              </button>
            </div>

            <AuthMessages error={error} notice={notice} />

            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form className="authCard" onSubmit={handleForgotPassword}>
            <AuthHeader
              title="Mot de passe oublié"
              intro="Entrez le courriel associé à votre compte. Le lien envoyé sera valide 30 minutes."
            />

            <label className="field">
              Adresse courriel
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nom@exemple.com"
                required
              />
            </label>

            <AuthMessages error={error} notice={notice} />

            {debugResetUrl && (
              <a className="resetPreviewLink" href={debugResetUrl}>
                Ouvrir le lien de test
              </a>
            )}

            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer le lien"}
            </button>
            <button className="authBackButton" type="button" onClick={() => showMode("login")}>
              Retour à la connexion
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form className="authCard" onSubmit={handleResetPassword}>
            <AuthHeader
              title="Nouveau mot de passe"
              intro="Choisissez un mot de passe d’au moins 8 caractères."
            />

            <PasswordField
              label="Nouveau mot de passe"
              name="new-password"
              value={password}
              showPassword={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
              minLength={8}
            />
            <PasswordField
              label="Confirmer le mot de passe"
              name="confirm-password"
              value={confirmPassword}
              showPassword={showPassword}
              onChange={setConfirmPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
              minLength={8}
            />

            <AuthMessages error={error} notice={notice} />

            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Modification..." : "Modifier le mot de passe"}
            </button>
            <button className="authBackButton" type="button" onClick={() => showMode("login")}>
              Annuler
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function AuthHeader({ title, intro }) {
  return (
    <>
      <h2>{title}</h2>
      <p className="authIntro">{intro}</p>
    </>
  );
}

function PasswordField({
  label,
  name,
  value,
  showPassword,
  onChange,
  onToggle,
  autoComplete,
  minLength
}) {
  return (
    <label className="field">
      {label}
      <span className="passwordRow">
        <input
          type={showPassword ? "text" : "password"}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          className="iconButton"
          type="button"
          onClick={onToggle}
          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          <PasswordIcon visible={showPassword} />
        </button>
      </span>
    </label>
  );
}

function AuthMessages({ error, notice }) {
  return (
    <>
      {error && <p className="errorText" role="alert">{error}</p>}
      {notice && <p className="authNotice" role="status">{notice}</p>}
    </>
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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}
