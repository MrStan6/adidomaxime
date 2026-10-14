"use server";

import { quoteRequestSchema } from "@/lib/validation/public-forms";
import type { FormState } from "@/lib/validation/common";
import { parsePublicForm } from "@/server/public-form";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { createQuoteRequest } from "@/server/repositories/quotes";
import { notifyStaff } from "@/server/email/mailer";
import { getSiteConfig } from "@/server/settings";
import { formatDate } from "@/lib/format";

export async function submitQuoteRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = await parsePublicForm("quote", fd, quoteRequestSchema, RATE_LIMITS.quoteForm, ["equipment"]);
  if (!parsed.ok) return parsed.state;
  const d = parsed.data;
  try {
    const { reference } = await createQuoteRequest({
      request_type: d.request_type,
      full_name: d.full_name,
      organization: d.organization,
      phone: d.phone,
      email: d.email,
      event_type: d.event_type,
      venue_id: d.venue === "recommend" ? null : d.venue,
      event_date: d.event_date,
      start_time: d.start_time,
      end_time: d.end_time,
      participants: d.participants,
      layout: d.layout,
      equipment: d.equipment,
      catering: d.catering,
      budget: d.budget,
      message: d.message,
      source: "website",
      privacy_accepted: true,
    });
    const config = await getSiteConfig();
    await notifyStaff(
      `Nouvelle demande ${reference} — ${d.event_type}, ${formatDate(d.event_date)}`,
      [
        `Référence : ${reference}`,
        `Type : ${d.request_type === "availability" ? "Vérification de disponibilité" : "Demande de devis"}`,
        `Demandeur : ${d.full_name}${d.organization ? ` (${d.organization})` : ""}`,
        `Téléphone : ${d.phone} — Courriel : ${d.email}`,
        `Événement : ${d.event_type}, le ${formatDate(d.event_date)} de ${d.start_time} à ${d.end_time}, ${d.participants} participants`,
        "",
        `À traiter dans l'administration : ${config.siteUrl}/admin/demandes`,
      ].join("\n"),
      d.email,
    );
    return { status: "success", message: "sent", data: { reference, requestType: d.request_type } };
  } catch (err) {
    console.error("[devis] enregistrement impossible :", err);
    return {
      status: "error",
      message: "Votre demande n'a pas pu être enregistrée suite à un incident technique. Réessayez dans quelques minutes ou contactez-nous directement.",
      values: Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === "string" && !["form_token", "website_url"].includes(k))) as Record<string, string>,
    };
  }
}
