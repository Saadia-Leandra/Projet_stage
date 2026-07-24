import crypto from "node:crypto";
import { createToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";

export class AuthService {
  constructor({ usersRepo, passwordResetMailer, appPublicUrl }) {
    this.usersRepo = usersRepo;
    this.passwordResetMailer = passwordResetMailer;
    this.appPublicUrl = appPublicUrl;
  }

  async login({ identifier, password, rememberMe = false }) {
    if (!identifier || !password) {
      const error = new Error("Identifiant et mot de passe requis.");
      error.status = 400;
      throw error;
    }

    const user = await this.usersRepo.findByIdentifier(identifier);

    if (!user) {
      const error = new Error("Identifiants invalides.");
      error.status = 401;
      throw error;
    }

    const passwordIsValid = await verifyPassword(password, user.passwordHash);

    if (!passwordIsValid) {
      const error = new Error("Identifiants invalides.");
      error.status = 401;
      throw error;
    }

    const publicUser = toPublicUser(user);
    const token = createToken(publicUser, { rememberMe: rememberMe === true });

    return {
      token,
      user: publicUser,
      expiresIn: rememberMe === true ? "30d" : "8h"
    };
  }

  async requestPasswordReset({ email, requestOrigin }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      const error = new Error("Veuillez fournir une adresse courriel valide.");
      error.status = 400;
      throw error;
    }

    const user = await this.usersRepo.findByEmail(normalizedEmail);
    const response = {
      message: "Si un compte correspond à cette adresse, un courriel de réinitialisation sera envoyé."
    };

    if (!user) return response;

    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.usersRepo.createPasswordResetToken(user.id, tokenHash, expiresAt);

    const baseUrl = String(this.appPublicUrl || requestOrigin || "").replace(/\/+$/, "");
    const resetUrl = `${baseUrl}/?resetToken=${encodeURIComponent(rawToken)}`;
    const mailResult = await this.passwordResetMailer.sendPasswordReset({
      email: user.email,
      resetUrl
    });

    if (mailResult.previewUrl && process.env.NODE_ENV !== "production") {
      response.debugResetUrl = mailResult.previewUrl;
    }

    return response;
  }

  async resetPassword({ token, password }) {
    if (!token || typeof token !== "string") {
      const error = new Error("Lien de réinitialisation invalide.");
      error.status = 400;
      throw error;
    }

    if (!isStrongEnoughPassword(password)) {
      const error = new Error("Le mot de passe doit contenir au moins 8 caractères.");
      error.status = 400;
      throw error;
    }

    const passwordHash = await hashPassword(password);
    const updated = await this.usersRepo.consumePasswordResetToken(
      hashResetToken(token),
      passwordHash
    );

    if (!updated) {
      const error = new Error("Ce lien est invalide, expiré ou déjà utilisé.");
      error.status = 400;
      throw error;
    }

    return { message: "Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter." };
  }
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: `${user.firstName} ${user.lastName}`,
    codePermanent: user.codePermanent,
    studentCode: user.studentCode,
    employeeNumber: user.employeeNumber,
    mileageRate: user.mileageRate,
    role: user.role,
    status: user.status
  };
}
