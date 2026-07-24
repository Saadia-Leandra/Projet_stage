import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import { AuthService } from "../services/authService.js";
import { hashPassword, verifyPassword } from "../services/password.js";

test("login crée une session de 8 h par défaut et de 30 jours si mémorisée", async () => {
  const passwordHash = await hashPassword("motdepasse");
  const usersRepo = {
    async findByIdentifier() {
      return testUser(passwordHash);
    }
  };
  const service = new AuthService({ usersRepo });

  const regular = await service.login({
    identifier: "test@example.com",
    password: "motdepasse"
  });
  const remembered = await service.login({
    identifier: "test@example.com",
    password: "motdepasse",
    rememberMe: true
  });

  const regularPayload = jwt.decode(regular.token);
  const rememberedPayload = jwt.decode(remembered.token);

  assert.equal(regular.expiresIn, "8h");
  assert.equal(remembered.expiresIn, "30d");
  assert.ok(regularPayload.exp - regularPayload.iat <= 8 * 60 * 60);
  assert.ok(rememberedPayload.exp - rememberedPayload.iat >= 29 * 24 * 60 * 60);
});

test("requestPasswordReset génère un lien et resetPassword consomme le jeton", async () => {
  let storedTokenHash = "";
  let storedPasswordHash = "";
  let resetUrl = "";
  const usersRepo = {
    async findByEmail() {
      return { id: 7, email: "test@example.com" };
    },
    async createPasswordResetToken(_userId, tokenHash) {
      storedTokenHash = tokenHash;
    },
    async consumePasswordResetToken(tokenHash, passwordHash) {
      assert.equal(tokenHash, storedTokenHash);
      storedPasswordHash = passwordHash;
      return true;
    }
  };
  const passwordResetMailer = {
    async sendPasswordReset(message) {
      resetUrl = message.resetUrl;
      return { previewUrl: resetUrl };
    }
  };
  const service = new AuthService({
    usersRepo,
    passwordResetMailer,
    appPublicUrl: "https://stagetec.example"
  });

  const requested = await service.requestPasswordReset({
    email: "test@example.com"
  });
  const rawToken = new URL(requested.debugResetUrl).searchParams.get("resetToken");

  assert.ok(rawToken);
  assert.equal(resetUrl, requested.debugResetUrl);

  const result = await service.resetPassword({
    token: rawToken,
    password: "nouveauMotDePasse"
  });

  assert.match(result.message, /modifié/);
  assert.equal(await verifyPassword("nouveauMotDePasse", storedPasswordHash), true);
});

test("requestPasswordReset retourne le même message pour un compte inconnu", async () => {
  const service = new AuthService({
    usersRepo: {
      async findByEmail() {
        return null;
      }
    },
    passwordResetMailer: {
      async sendPasswordReset() {
        throw new Error("ne doit pas être appelé");
      }
    }
  });

  const result = await service.requestPasswordReset({
    email: "inconnu@example.com",
    requestOrigin: "http://localhost:3000"
  });

  assert.match(result.message, /Si un compte correspond/);
  assert.equal(result.debugResetUrl, undefined);
});

function testUser(passwordHash) {
  return {
    id: 1,
    email: "test@example.com",
    passwordHash,
    firstName: "Test",
    lastName: "Utilisateur",
    role: "ETUDIANT",
    status: "ACTIF"
  };
}
