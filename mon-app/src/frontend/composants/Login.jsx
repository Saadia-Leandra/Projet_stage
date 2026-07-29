import { useState } from "react";
import { saveAuthSession } from "../services/authSession.js";
import "../assets/auth.css";

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resetSession, setResetSession] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [debugResetCode, setDebugResetCode] = useState("");
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
      setDebugResetCode(response.data.debugResetCode || "");
      setMode("verify");
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    startRequest();

    try {
      const response = await postJson("/api/auth/verify-reset-code", {
        email,
        code: verificationCode
      });

      if (!response.ok) {
        setError(response.data.error || "Code de vérification invalide.");
        return;
      }

      setResetSession(response.data.resetSession);
      setVerificationCode("");
      setNotice(response.data.message);
      setMode("reset");
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
        resetSession,
        password,
        confirmPassword
      });

      if (!response.ok) {
        setError(response.data.error || "Impossible de modifier le mot de passe.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setResetSession("");
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
    setDebugResetCode("");
    setLoading(true);
  }

  function showMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
    setDebugResetCode("");
    setVerificationCode("");
    setResetSession("");
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
              intro="Entrez le courriel associé à votre compte. Un code valide 10 minutes vous sera envoyé."
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

            <button className="primaryButton" type="submit" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer le code"}
            </button>
            <button className="authBackButton" type="button" onClick={() => showMode("login")}>
              Retour à la connexion
            </button>
          </form>
        )}

        {mode === "verify" && (
          <form className="authCard" onSubmit={handleVerifyCode}>
            <AuthHeader
              title="Vérification"
              intro="Saisissez le code à 6 chiffres envoyé à votre adresse courriel."
            />

            <label className="field">
              Code de vérification
              <input
                className="verificationCodeInput"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={verificationCode}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                pattern="\d{6}"
                maxLength={6}
                required
              />
            </label>

            <AuthMessages error={error} notice={notice} />

            {debugResetCode && (
              <p className="resetPreviewCode">
                Code de développement : <strong>{debugResetCode}</strong>
              </p>
            )}

            <button
              className="primaryButton"
              type="submit"
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? "Vérification..." : "Vérifier le code"}
            </button>
            <button className="authBackButton" type="button" onClick={() => showMode("forgot")}>
              Renvoyer un code
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
              intro="Choisissez une phrase de passe contenant entre 12 et 128 caractères."
            />

            <PasswordField
              label="Nouveau mot de passe"
              name="new-password"
              value={password}
              showPassword={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
              minLength={12}
            />
            <PasswordField
              label="Confirmer le mot de passe"
              name="confirm-password"
              value={confirmPassword}
              showPassword={showPassword}
              onChange={setConfirmPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
              minLength={12}
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
