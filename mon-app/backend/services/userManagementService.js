import { hashPassword } from "./password.js";

const ROLES = new Set(["ETUDIANT", "SUPERVISEUR", "CONSEILLERE", "COMPTABILITE", "DIRECTION"]);

export class UserManagementService {
  constructor({ usersRepo }) { this.usersRepo = usersRepo; }

  list() { return this.usersRepo.findAll(); }

  async create(payload) {
    const entries = Array.isArray(payload?.users) ? payload.users : [];
    if (!entries.length || entries.length > 100) throw clientError("Ajoutez entre 1 et 100 utilisateurs.");
    const emails = new Set();
    const users = [];
    for (let index = 0; index < entries.length; index += 1) {
      const user = normalize(entries[index]);
      validate(user, index + 1);
      if (emails.has(user.email)) throw clientError(`Ligne ${index + 1}: courriel en double.`);
      emails.add(user.email);
      users.push({ ...user, passwordHash: await hashPassword(user.password) });
    }
    try {
      return await this.usersRepo.createMany(users);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") throw clientError("Un courriel ou un identifiant existe deja.", 409);
      throw error;
    }
  }

  async remove(payload, currentUserId) {
    const ids = [...new Set((Array.isArray(payload?.ids) ? payload.ids : []).map(Number))]
      .filter(Number.isSafeInteger).filter((id) => id > 0);
    if (!ids.length || ids.length > 100) throw clientError("Selectionnez entre 1 et 100 utilisateurs.");
    if (ids.includes(Number(currentUserId))) throw clientError("Vous ne pouvez pas supprimer votre propre compte.");
    try {
      const count = await this.usersRepo.deleteMany(ids);
      if (count !== ids.length) throw clientError("Un ou plusieurs utilisateurs n'existent plus.", 404);
      return count;
    } catch (error) {
      if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
        throw clientError("Suppression impossible: un utilisateur selectionne est lie a des donnees existantes.", 409);
      }
      throw error;
    }
  }

  async update(idValue, payload, currentUserId) {
    const id = Number(idValue);
    if (!Number.isSafeInteger(id) || id < 1) throw clientError("Identifiant utilisateur invalide.");
    const existing = (await this.usersRepo.findAll()).find((user) => Number(user.id) === id);
    if (!existing) throw clientError("Utilisateur introuvable.", 404);
    if (payload?.role && String(payload.role).toUpperCase() !== existing.role) {
      throw clientError("Le role ne peut pas etre modifie.");
    }
    const user = normalize({ ...existing, ...payload, role: existing.role });
    user.status = String(payload?.status ?? existing.status).trim().toUpperCase();
    validate(user, 1, false);
    if (!new Set(["ACTIF", "INACTIF"]).has(user.status)) throw clientError("Statut invalide.");
    if (id === Number(currentUserId) && user.status === "INACTIF") {
      throw clientError("Vous ne pouvez pas desactiver votre propre compte.");
    }
    if (user.password && user.password.length < 8) throw clientError("Le mot de passe doit avoir au moins 8 caracteres.");
    if (user.password) user.passwordHash = await hashPassword(user.password);
    try {
      return await this.usersRepo.update(id, user);
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") throw clientError("Le courriel, le code ou le numero d'employe existe deja.", 409);
      throw error;
    }
  }
}

function normalize(value = {}) {
  const clean = (key) => String(value[key] || "").trim();
  return { firstName: clean("firstName"), lastName: clean("lastName"), email: clean("email").toLowerCase(),
    phone: clean("phone") || null, password: String(value.password || ""), role: clean("role").toUpperCase(),
    studentCode: clean("studentCode") || null, permanentCode: clean("permanentCode") || null,
    program: clean("program") || null, employeeNumber: clean("employeeNumber") || null,
    department: clean("department") || null };
}

function validate(user, line, passwordRequired = true) {
  if (!user.firstName || !user.lastName || !user.email || (passwordRequired && !user.password) || !user.role)
    throw clientError(`Ligne ${line}: les champs obligatoires sont requis.`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) throw clientError(`Ligne ${line}: courriel invalide.`);
  if (user.password && user.password.length < 8) throw clientError(`Ligne ${line}: le mot de passe doit avoir au moins 8 caracteres.`);
  if (!ROLES.has(user.role)) throw clientError(`Ligne ${line}: role invalide.`);
  if (user.role === "ETUDIANT" && (!user.studentCode || !user.program))
    throw clientError(`Ligne ${line}: code etudiant et programme requis.`);
  if (["SUPERVISEUR", "COMPTABILITE"].includes(user.role) && !user.employeeNumber)
    throw clientError(`Ligne ${line}: numero d'employe requis.`);
}

function clientError(message, status = 400) { const error = new Error(message); error.status = status; return error; }
