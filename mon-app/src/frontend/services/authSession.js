const SESSION_MARKER = "stagetec-session-active";
const AUTH_MODE = "stagetec-auth-mode";

export function saveAuthSession({ token, user, rememberMe }) {
  clearAuthSession();

  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem(AUTH_MODE, rememberMe ? "remembered" : "session");

  if (!rememberMe) {
    sessionStorage.setItem(SESSION_MARKER, "true");
  }
}

export function restoreAuthUser() {
  const mode = localStorage.getItem(AUTH_MODE);

  if (mode === "session" && sessionStorage.getItem(SESSION_MARKER) !== "true") {
    clearAuthSession();
    return null;
  }

  const savedUser = localStorage.getItem("user");
  const token = localStorage.getItem("token");

  if (!savedUser || !token) {
    clearAuthSession();
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    clearAuthSession();
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem(AUTH_MODE);
  sessionStorage.removeItem(SESSION_MARKER);
}
