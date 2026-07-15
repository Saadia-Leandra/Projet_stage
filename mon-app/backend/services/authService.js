import { createToken } from "./jwt.js";
import { verifyPassword } from "./password.js";

export class AuthService {
  constructor({ usersRepo }) {
    this.usersRepo = usersRepo;
  }

  async login({ identifier, password }) {
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
    const token = createToken(publicUser);

    return {
      token,
      user: publicUser
    };
  }
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
