import crypto from "node:crypto";
import { createToken } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";

export class AuthService {
  constructor({
    usersRepo,
    passwordResetMailer,
    resetSecret = process.env.JWT_SECRET || "dev-secret"
  }) {
    this.usersRepo = usersRepo;
    this.passwordResetMailer = passwordResetMailer;
    this.resetSecret = resetSecret;
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

  async requestPasswordReset({ email }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      const error = new Error("Veuillez fournir une adresse courriel valide.");
      error.status = 400;
      throw error;
    }

    const user = await this.usersRepo.findByEmail(normalizedEmail);
    const response = {
      message: "Si un compte correspond à cette adresse, un code de vérification sera envoyé."
    };

    if (!user) return response;

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.usersRepo.createPasswordResetCode(
      user.id,
      hashResetValue(code, this.resetSecret),
      expiresAt
    );

    const mailResult = await this.passwordResetMailer.sendPasswordResetCode({
      email: user.email,
      code
    });

    if (mailResult.previewCode && process.env.NODE_ENV !== "production") {
      response.debugResetCode = mailResult.previewCode;
    }

    return response;
  }

  async verifyPasswordResetCode({ email, code }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").replace(/\s/g, "");

    if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(normalizedCode)) {
      throw invalidCodeError();
    }

    const user = await this.usersRepo.findByEmail(normalizedEmail);
    if (!user) throw invalidCodeError();

    const resetSession = crypto.randomBytes(32).toString("base64url");
    const verified = await this.usersRepo.verifyPasswordResetCode({
      userId: user.id,
      codeHash: hashResetValue(normalizedCode, this.resetSecret),
      sessionTokenHash: hashResetValue(resetSession, this.resetSecret),
      sessionExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      maxAttempts: 5
    });

    if (!verified) throw invalidCodeError();

    return {
      resetSession,
      message: "Code vérifié. Vous pouvez maintenant choisir un nouveau mot de passe."
    };
  }

  async resetPassword({ resetSession, password, confirmPassword }) {
    if (!resetSession || typeof resetSession !== "string") {
      const error = new Error("Session de réinitialisation invalide ou expirée.");
      error.status = 400;
      throw error;
    }

    if (password !== confirmPassword) {
      const error = new Error("Les deux mots de passe ne correspondent pas.");
      error.status = 400;
      throw error;
    }

    if (!isStrongEnoughPassword(password)) {
      const error = new Error("Le mot de passe doit contenir entre 12 et 128 caractères.");
      error.status = 400;
      throw error;
    }

    const passwordHash = await hashPassword(password);
    const updated = await this.usersRepo.consumePasswordResetSession(
      hashResetValue(resetSession, this.resetSecret),
      passwordHash
    );

    if (!updated) {
      const error = new Error("Cette session est invalide, expirée ou déjà utilisée.");
      error.status = 400;
      throw error;
    }

    return { message: "Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter." };
  }
}

function hashResetValue(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(password) {
  return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

function invalidCodeError() {
  const error = new Error("Code invalide, expiré ou nombre maximal de tentatives atteint.");
  error.status = 400;
  return error;
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
