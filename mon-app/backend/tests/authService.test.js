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

test("le code de vérification ouvre une session puis permet de changer le mot de passe", async () => {
  let storedCodeHash = "";
  let storedSessionHash = "";
  let storedPasswordHash = "";
  let sentCode = "";
  const usersRepo = {
    async findByEmail() {
      return { id: 7, email: "test@example.com" };
    },
    async createPasswordResetCode(_userId, codeHash) {
      storedCodeHash = codeHash;
    },
    async verifyPasswordResetCode({ codeHash, sessionTokenHash }) {
      if (codeHash !== storedCodeHash) return false;
      storedSessionHash = sessionTokenHash;
      return true;
    },
    async consumePasswordResetSession(sessionTokenHash, passwordHash) {
      assert.equal(sessionTokenHash, storedSessionHash);
      storedPasswordHash = passwordHash;
      return true;
    }
  };
  const passwordResetMailer = {
    async sendPasswordResetCode({ code }) {
      sentCode = code;
      return { previewCode: code };
    }
  };
  const service = new AuthService({
    usersRepo,
    passwordResetMailer,
    resetSecret: "test-reset-secret"
  });

  const requested = await service.requestPasswordReset({
    email: "test@example.com"
  });

  assert.match(sentCode, /^\d{6}$/);
  assert.equal(requested.debugResetCode, sentCode);

  const verified = await service.verifyPasswordResetCode({
    email: "test@example.com",
    code: sentCode
  });

  assert.ok(verified.resetSession);

  const result = await service.resetPassword({
    resetSession: verified.resetSession,
    password: "nouveauMotDePasse",
    confirmPassword: "nouveauMotDePasse"
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
      async sendPasswordResetCode() {
        throw new Error("ne doit pas être appelé");
      }
    }
  });

  const result = await service.requestPasswordReset({
    email: "inconnu@example.com"
  });

  assert.match(result.message, /Si un compte correspond/);
  assert.equal(result.debugResetCode, undefined);
});

test("verifyPasswordResetCode refuse un code invalide", async () => {
  const service = new AuthService({
    usersRepo: {
      async findByEmail() {
        return { id: 7, email: "test@example.com" };
      },
      async verifyPasswordResetCode() {
        return false;
      }
    },
    resetSecret: "test-reset-secret"
  });

  await assert.rejects(
    service.verifyPasswordResetCode({
      email: "test@example.com",
      code: "123456"
    }),
    /Code invalide/
  );
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
