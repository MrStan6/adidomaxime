import { query, queryOne, type Queryable, pool } from "../db";
import { audit } from "../audit";
import { sha256 } from "../security/crypto";
import { RATE_LIMITS, clearHits, isRateLimited, recordHit } from "../security/rate-limit";
import { dummyHashOnce, verifyPassword } from "./password";

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; error: "invalid" | "rate_limited" };

/**
 * Vérifie des identifiants avec limitation des tentatives (par IP et par
 * compte). Le message d'erreur ne révèle pas si le compte existe.
 */
export async function authenticate(
  emailRaw: string,
  password: string,
  ipKey: string,
  db: Queryable = pool(),
): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const accountKey = sha256(`acct:${email}`);

  if (
    (await isRateLimited(RATE_LIMITS.loginPerIp, ipKey, db)) ||
    (await isRateLimited(RATE_LIMITS.loginPerAccount, accountKey, db))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const user = await queryOne<{ id: string; password_hash: string; is_active: boolean }>(
    "SELECT id, password_hash, is_active FROM users WHERE lower(email) = $1",
    [email],
    db,
  );
  const valid = await verifyPassword(password, user?.password_hash ?? (await dummyHashOnce()));

  if (!user || !valid || !user.is_active) {
    await recordHit(RATE_LIMITS.loginPerIp, ipKey, db);
    await recordHit(RATE_LIMITS.loginPerAccount, accountKey, db);
    if (user) await audit({ actorId: user.id, action: "auth.login_failed", entityType: "user", entityId: user.id }, db);
    return { ok: false, error: "invalid" };
  }

  await clearHits(RATE_LIMITS.loginPerAccount, accountKey, db);
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id], db);
  await audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id }, db);
  return { ok: true, userId: user.id };
}
