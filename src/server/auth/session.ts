import { query, queryOne, type Queryable, pool } from "../db";
import { randomToken, sha256 } from "../security/crypto";

/**
 * Sessions côté serveur : le navigateur reçoit un jeton aléatoire dans un
 * cookie httpOnly ; seule son empreinte SHA-256 est stockée en base. Une
 * session peut donc être révoquée immédiatement (désactivation de compte,
 * déconnexion, changement de mot de passe).
 */
export const SESSION_TTL_HOURS = 12;

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  must_change_password: boolean;
  session_id: string;
};

export async function createSession(
  userId: string,
  meta: { ipHash?: string; userAgent?: string } = {},
  db: Queryable = pool(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await query(
    `INSERT INTO sessions (id, user_id, expires_at, ip_hash, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [sha256(token), userId, expiresAt, meta.ipHash ?? null, meta.userAgent ?? null],
    db,
  );
  // nettoyage opportuniste des sessions expirées
  await query("DELETE FROM sessions WHERE expires_at < now()", [], db);
  return { token, expiresAt };
}

export async function findSessionUser(token: string | undefined | null, db: Queryable = pool()): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  return queryOne<SessionUser>(
    `SELECT u.id, u.email, u.full_name, u.role, u.must_change_password, s.id AS session_id
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.is_active`,
    [sha256(token)],
    db,
  );
}

export async function destroySession(token: string, db: Queryable = pool()) {
  await query("DELETE FROM sessions WHERE id = $1", [sha256(token)], db);
}

export async function destroyUserSessions(userId: string, exceptSessionId?: string, db: Queryable = pool()) {
  await query("DELETE FROM sessions WHERE user_id = $1 AND ($2::text IS NULL OR id <> $2)", [userId, exceptSessionId ?? null], db);
}
