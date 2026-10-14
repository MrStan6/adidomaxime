import { cache } from "react";
import { query, queryOne, type Queryable, pool } from "./db";

/** Blocs de texte éditables depuis l'administration. */
export type ContentBlock = { key: string; title: string; body: string };

export const getContentBlocks = cache(async (locale = "fr"): Promise<Record<string, ContentBlock>> => {
  const rows = await query<ContentBlock>("SELECT key, title, body FROM content_blocks WHERE locale = $1", [locale]);
  return Object.fromEntries(rows.map((r) => [r.key, r]));
});

export async function getContent(key: string, locale = "fr"): Promise<ContentBlock> {
  const all = await getContentBlocks(locale);
  return all[key] ?? { key, title: "", body: "" };
}

export async function listContentBlocks(db: Queryable = pool()) {
  return query<ContentBlock & { updated_at: Date }>(
    "SELECT key, title, body, updated_at FROM content_blocks WHERE locale = 'fr' ORDER BY key",
    [],
    db,
  );
}

export async function updateContentBlock(key: string, title: string, body: string, userId: string, db: Queryable = pool()) {
  return queryOne(
    `UPDATE content_blocks SET title = $2, body = $3, updated_by = $4, updated_at = now()
      WHERE key = $1 AND locale = 'fr' RETURNING key`,
    [key, title, body, userId],
    db,
  );
}

/** Correspondance entre les pages juridiques publiques et les blocs. */
export const LEGAL_PAGES = {
  "mentions-legales": "legal.mentions",
  confidentialite: "legal.privacy",
  cookies: "legal.cookies",
  "conditions-reservation": "legal.booking_terms",
  "conditions-annulation": "legal.cancellation",
  "conditions-location-salles": "legal.venue_rental",
} as const;
export type LegalSlug = keyof typeof LEGAL_PAGES;
