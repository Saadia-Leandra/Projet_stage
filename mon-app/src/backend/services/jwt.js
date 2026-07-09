import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const secret = process.env.JWT_SECRET || "dev-secret";

export function createToken(user) {
  return jwt.sign(user, secret, {
    expiresIn: "8h"
  });
}

export function readToken(token) {
  return jwt.verify(token, secret);
}
