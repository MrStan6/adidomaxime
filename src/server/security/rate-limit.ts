import { query, queryOne, type Queryable, pool } from "../db";

/**
 * Limitation de débit persistée en base (fonctionne même avec plusieurs
 * instances de l'application). Fenêtre glissante.
 */
export type RateLimitRule = { bucket: string; max: number; windowSeconds: number };

export const RATE_LIMITS = {
  loginPerIp: { bucket: "login_ip", max: 20, windowSeconds: 15 * 60 },
  loginPerAccount: { bucket: "login_account", max: 5, windowSeconds: 15 * 60 },
  quoteForm: { bucket: "quote_form", max: 5, windowSeconds: 60 * 60 },
  contactForm: { bucket: "contact_form", max: 5, windowSeconds: 60 * 60 },
  roomBooking: { bucket: "room_booking", max: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export async function isRateLimited(rule: RateLimitRule, key: string, db: Queryable = pool()): Promise<boolean> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM rate_limit_events
      WHERE bucket = $1 AND key = $2 AND created_at > now() - make_interval(secs => $3)`,
    [rule.bucket, key, rule.windowSeconds],
    db,
  );
  return Number(row?.n ?? 0) >= rule.max;
}

export async function recordHit(rule: RateLimitRule, key: string, db: Queryable = pool()) {
  await query("INSERT INTO rate_limit_events (bucket, key) VALUES ($1, $2)", [rule.bucket, key], db);
}

export async function clearHits(rule: RateLimitRule, key: string, db: Queryable = pool()) {
  await query("DELETE FROM rate_limit_events WHERE bucket = $1 AND key = $2", [rule.bucket, key], db);
}

/** Purge des anciens événements (appelée de façon opportuniste). */
export async function purgeOldRateLimitEvents(db: Queryable = pool()) {
  await query("DELETE FROM rate_limit_events WHERE created_at < now() - interval '2 days'", [], db);
}
