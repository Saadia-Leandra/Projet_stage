import { readToken } from "../services/jwt.js";

export function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentification requise." });
  }

  try {
    req.user = readToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Token invalide." });
  }
}

export function requireLogin(req, res, next) {
  auth(req, res, () => {
    if (req.user.mustChangePassword) {
      return res.status(403).json({
        error: "Vous devez créer votre mot de passe personnel avant de continuer.",
        code: "PASSWORD_CHANGE_REQUIRED"
      });
    }

    next();
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acces refuse." });
    }

    next();
  };
}
