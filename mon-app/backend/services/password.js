import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SCRYPT_KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH);

  return `scrypt:${salt}:${Buffer.from(derivedKey).toString("base64url")}`;
}

export async function verifyPassword(password, passwordHash) {
  const hash = String(passwordHash || "");

  if (!hash.startsWith("scrypt:")) {
    return false;
  }

  const [algorithm, salt, storedKey] = hash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = await scrypt(password, salt, SCRYPT_KEY_LENGTH);
  const storedBuffer = Buffer.from(storedKey, "base64url");

  return (
    storedBuffer.length === derivedKey.length &&
    crypto.timingSafeEqual(storedBuffer, derivedKey)
  );
}
