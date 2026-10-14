"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { addQuoteNote, createQuoteRequest, updateQuoteCommercial } from "@/server/repositories/quotes";
import { getSiteConfig } from "@/server/settings";
import { QUOTE_STATUSES, EVENT_TYPES } from "@/lib/labels";
import { dateField, emailField, optionalText, phoneField, requiredText, type FormState } from "@/lib/validation/common";

const optUuid = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || z.string().uuid().safeParse(v).success, "Sélection invalide.");
const optTime = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^\d{2}:\d{2}$/.test(v), "Heure invalide.");
const optDate = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date invalide.");

const commercialSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(QUOTE_STATUSES),
  quoted_amount: z.string().optional().transform((v) => (v ? Number(v.replace(",", ".").replace(/\s/g, "")) : null)).refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Montant invalide."),
  follow_up_on: optDate,
  assigned_to: optUuid,
  venue_id: optUuid,
  event_date: dateField("La date"),
  start_time: optTime,
  end_time: optTime,
  participants: z.coerce.number().int().min(1, "Au moins 1 participant."),
});

export async function updateQuote(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("quotes.manage", fd, commercialSchema, async (d, user) => {
    const config = await getSiteConfig();
    await updateQuoteCommercial(d.id, { ...d, quoted_currency: d.quoted_amount !== null ? config.currency : null }, user.id);
    revalidatePath(`/admin/demandes/${d.id}`);
    return { status: "success", message: "Suivi commercial mis à jour." };
  });
}

const noteSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["comment", "follow_up"]),
  body: requiredText("La note", 2, 3000),
});

export async function addNote(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("quotes.manage", fd, noteSchema, async (d, user) => {
    await addQuoteNote(d.id, user.id, d.body, d.kind);
    revalidatePath(`/admin/demandes/${d.id}`);
    return { status: "success", message: "Note ajoutée." };
  });
}

const manualSchema = z.object({
  source: z.enum(["whatsapp", "phone", "email", "walk_in", "other"]),
  request_type: z.enum(["quote", "availability"]),
  full_name: requiredText("Le nom", 2, 120),
  organization: optionalText(160),
  phone: phoneField,
  email: z.string().optional().transform((v) => v || undefined).pipe(emailField.optional()),
  event_type: z.enum(EVENT_TYPES),
  venue_id: optUuid,
  event_date: dateField("La date"),
  start_time: optTime,
  end_time: optTime,
  participants: z.coerce.number().int().min(1, "Au moins 1 participant."),
  message: optionalText(3000),
});

export async function createManualQuote(_p: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const res = await adminAction("quotes.manage", fd, manualSchema, async (d, user) => {
    const q = await createQuoteRequest({ ...d, equipment: [], privacy_accepted: false, created_by: user.id });
    id = q.id;
  });
  if (res.status === "success" && id) redirect(`/admin/demandes/${id}`);
  return res;
}
