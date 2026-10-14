import { query, queryOne, type Queryable, pool } from "../db";

export type Faq = { id: string; category: string; question: string; answer: string; is_published: boolean; sort_order: number };

export async function listPublishedFaqs(category?: string, db: Queryable = pool()) {
  return query<Faq>(
    "SELECT * FROM faqs WHERE is_published AND locale = 'fr' AND ($1::text IS NULL OR category = $1) ORDER BY sort_order, question",
    [category ?? null],
    db,
  );
}

export async function listAllFaqs(db: Queryable = pool()) {
  return query<Faq>("SELECT * FROM faqs WHERE locale = 'fr' ORDER BY category, sort_order, question", [], db);
}

export async function upsertFaq(f: Omit<Faq, "id"> & { id?: string }, db: Queryable = pool()) {
  if (f.id) {
    return queryOne<{ id: string }>(
      "UPDATE faqs SET category=$2, question=$3, answer=$4, is_published=$5, sort_order=$6 WHERE id=$1 RETURNING id",
      [f.id, f.category, f.question, f.answer, f.is_published, f.sort_order],
      db,
    );
  }
  return queryOne<{ id: string }>(
    "INSERT INTO faqs (category, question, answer, is_published, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [f.category, f.question, f.answer, f.is_published, f.sort_order],
    db,
  );
}

export async function deleteFaq(id: string, db: Queryable = pool()) {
  await query("DELETE FROM faqs WHERE id = $1", [id], db);
}
