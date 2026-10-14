import { query, queryOne, type Queryable, pool } from "../db";
import { audit } from "../audit";
import type { ContactInput } from "@/lib/validation/public-forms";

export type ContactMessage = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  topic: string;
  message: string;
  status: "new" | "handled" | "archived";
  created_at: Date;
  handled_at: Date | null;
  handled_by_name: string | null;
};

export async function createContactMessage(input: ContactInput, db: Queryable = pool()) {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO contact_messages (full_name, email, phone, topic, message, privacy_accepted_at)
     VALUES ($1,$2,$3,$4,$5, now()) RETURNING id`,
    [input.full_name, input.email ?? null, input.phone ?? null, input.topic, input.message],
    db,
  );
  await audit({ actorId: null, action: "contact.created", entityType: "contact_message", entityId: row!.id }, db);
  return row!;
}

export async function listContactMessages(status: string | undefined, db: Queryable = pool()) {
  return query<ContactMessage>(
    `SELECT m.*, u.full_name AS handled_by_name FROM contact_messages m LEFT JOIN users u ON u.id = m.handled_by
      WHERE ($1::text IS NULL OR m.status = $1) ORDER BY m.created_at DESC LIMIT 300`,
    [status || null],
    db,
  );
}

export async function setContactStatus(id: string, status: "new" | "handled" | "archived", userId: string, db: Queryable = pool()) {
  await query(
    `UPDATE contact_messages SET status = $2,
        handled_by = CASE WHEN $2 = 'new' THEN NULL ELSE $3::uuid END,
        handled_at = CASE WHEN $2 = 'new' THEN NULL ELSE now() END
      WHERE id = $1`,
    [id, status, userId],
    db,
  );
  await audit({ actorId: userId, action: "contact.status", entityType: "contact_message", entityId: id, details: { status } }, db);
}
