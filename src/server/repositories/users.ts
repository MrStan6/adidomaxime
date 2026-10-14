import { query, queryOne, withTransaction, PG, pgErrorCode, type Queryable, pool } from "../db";
import { audit } from "../audit";
import { hashPassword } from "../auth/password";
import { destroyUserSessions } from "../auth/session";
import type { Role } from "../auth/permissions";

export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
};

export class UserError extends Error {}

export async function listUsers(db: Queryable = pool()) {
  return query<UserRow>(
    "SELECT id, email, full_name, role, is_active, must_change_password, last_login_at, created_at FROM users ORDER BY is_active DESC, full_name",
    [],
    db,
  );
}

export async function userOptions(db: Queryable = pool()) {
  return query<{ id: string; full_name: string }>("SELECT id, full_name FROM users WHERE is_active ORDER BY full_name", [], db);
}

/** Création d'un compte nominatif (pas de compte partagé). */
export async function createUser(
  u: { email: string; full_name: string; role: Role; password: string; must_change_password?: boolean },
  actorId: string | null,
  db?: Queryable,
) {
  const run = async (c: Queryable) => {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO users (email, full_name, role, password_hash, must_change_password) VALUES (lower($1),$2,$3,$4,$5) RETURNING id`,
      [u.email.trim(), u.full_name.trim(), u.role, await hashPassword(u.password), u.must_change_password ?? true],
      c,
    );
    await audit({ actorId, action: "user.created", entityType: "user", entityId: row!.id, details: { email: u.email, role: u.role } }, c);
    return row!;
  };
  try {
    return db ? await run(db) : await withTransaction(run);
  } catch (err) {
    if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) throw new UserError("Un compte existe déjà avec cette adresse.");
    throw err;
  }
}

export async function updateUserAccess(id: string, changes: { role: Role; is_active: boolean; full_name: string }, actorId: string) {
  return withTransaction(async (db) => {
    if (id === actorId && (!changes.is_active || changes.role !== "admin")) {
      throw new UserError("Vous ne pouvez pas retirer vos propres droits d'administrateur ni désactiver votre compte.");
    }
    const before = await queryOne<{ role: string; is_active: boolean }>("SELECT role, is_active FROM users WHERE id = $1 FOR UPDATE", [id], db);
    if (!before) throw new UserError("Utilisateur introuvable.");
    if (before.role === "admin" && (changes.role !== "admin" || !changes.is_active)) {
      const admins = await queryOne<{ n: string }>("SELECT count(*)::text AS n FROM users WHERE role = 'admin' AND is_active AND id <> $1", [id], db);
      if (Number(admins?.n) === 0) throw new UserError("Il doit rester au moins un administrateur actif.");
    }
    await query("UPDATE users SET role = $2, is_active = $3, full_name = $4 WHERE id = $1", [id, changes.role, changes.is_active, changes.full_name], db);
    if (!changes.is_active || before.role !== changes.role) await destroyUserSessions(id, undefined, db);
    await audit({ actorId, action: "user.updated", entityType: "user", entityId: id, details: { before, after: changes } }, db);
  });
}

export async function setUserPassword(id: string, password: string, mustChange: boolean, actorId: string, keepSessionId?: string) {
  await withTransaction(async (db) => {
    await query("UPDATE users SET password_hash = $2, must_change_password = $3 WHERE id = $1", [id, await hashPassword(password), mustChange], db);
    await destroyUserSessions(id, keepSessionId, db);
    await audit({ actorId, action: id === actorId ? "user.password_changed" : "user.password_reset", entityType: "user", entityId: id }, db);
  });
}

export async function getPasswordHash(id: string) {
  return (await queryOne<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [id]))?.password_hash ?? null;
}

export async function listAudit(limit = 200, db: Queryable = pool()) {
  return query<{ id: string; action: string; entity_type: string; entity_id: string | null; details: Record<string, unknown>; created_at: Date; actor_name: string | null }>(
    `SELECT a.id::text, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.full_name AS actor_name
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.id DESC LIMIT $1`,
    [limit],
    db,
  );
}
