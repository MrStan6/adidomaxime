"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { changeVenueBookingStatus, createVenueBooking, VenueConflictError } from "@/server/repositories/venue-bookings";
import { getSiteConfig } from "@/server/settings";
import { recordManualPayment } from "@/server/payments/service";
import { dateField, optionalEmail, optionalPhone, optionalText, requiredText, timeField, type FormState } from "@/lib/validation/common";
import { PAYMENT_METHODS, VENUE_BOOKING_STATUSES } from "@/lib/labels";

const optUuid = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || z.string().uuid().safeParse(v).success, "Sélection invalide.");

const bookingSchema = z
  .object({
    kind: z.enum(["booking", "block"]),
    venue_id: z.string().uuid("Choisissez une salle."),
    title: requiredText("L'intitulé", 2, 160),
    start_date: dateField("La date de début"),
    start_time: timeField("L'heure de début"),
    end_date: dateField("La date de fin"),
    end_time: timeField("L'heure de fin"),
    status: z.enum(["option", "confirmed"]).default("option"),
    quote_id: optUuid,
    customer_id: optUuid,
    customer_name: optionalText(120),
    customer_organization: optionalText(160),
    customer_phone: optionalPhone,
    customer_email: optionalEmail,
    amount: z.string().optional().transform((v) => (v ? Number(v.replace(",", ".").replace(/\s/g, "")) : null)).refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Montant invalide."),
    option_expires_on: z.string().optional().transform((v) => v || null),
    block_reason: z.enum(["maintenance", "internal", "works", "other"]).optional(),
    notes: optionalText(2000),
    conditions_met: z.literal("on").optional(),
  })
  .refine((d) => `${d.end_date} ${d.end_time}` > `${d.start_date} ${d.start_time}`, { path: ["end_time"], message: "La fin doit être après le début." })
  .refine((d) => d.kind === "block" || d.customer_id || (d.customer_name && (d.customer_phone || d.customer_email)), {
    path: ["customer_name"],
    message: "Indiquez le client (nom et téléphone ou courriel).",
  });

export async function createBooking(_p: FormState, fd: FormData): Promise<FormState> {
  let created: string | null = null;
  const res = await adminAction("venue_bookings.manage", fd, bookingSchema, async (d, user) => {
    const config = await getSiteConfig();
    try {
      const b = await createVenueBooking(
        {
          ...d,
          timezone: config.timezone,
          currency: config.currency,
          customer: d.customer_id ? null : { full_name: d.customer_name ?? "", organization: d.customer_organization, phone: d.customer_phone, email: d.customer_email },
          block_reason: d.kind === "block" ? (d.block_reason ?? "other") : null,
          conditions_met: d.conditions_met === "on",
        },
        user.id,
      );
      created = b.id;
    } catch (err) {
      if (err instanceof VenueConflictError) {
        return {
          status: "error",
          message: `${err.message} En conflit : ${err.conflicts.map((c) => `${c.reference} « ${c.title} » (${c.starts} → ${c.ends})`).join(" ; ")}.`,
        };
      }
      throw err;
    }
  });
  if (created) redirect(`/admin/reservations-salles/${created}`);
  return res;
}

const statusSchema = z.object({
  id: z.string().uuid(),
  to: z.enum(VENUE_BOOKING_STATUSES),
  reason: optionalText(500),
  conditions_met: z.literal("on").optional(),
});

export async function changeBookingStatus(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("venue_bookings.manage", fd, statusSchema, async (d, user) => {
    await changeVenueBookingStatus(d.id, d.to, user.id, { reason: d.reason, conditionsMet: d.conditions_met === "on" });
    revalidatePath(`/admin/reservations-salles/${d.id}`);
    return { status: "success", message: "Statut mis à jour." };
  });
}

const paymentSchema = z.object({
  id: z.string().uuid(),
  amount: z.coerce.number({ invalid_type_error: "Montant invalide." }).positive("Le montant doit être positif."),
  method: z.enum(PAYMENT_METHODS),
  payment_type: z.enum(["deposit", "balance", "full", "refund"]),
  external_reference: optionalText(120),
});

export async function recordVenuePayment(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("payments.manage", fd, paymentSchema, async (d, user) => {
    const config = await getSiteConfig();
    if (!config.currency) return { status: "error", message: "Configurez d'abord la devise dans les paramètres." };
    await recordManualPayment({ target: { type: "venue_booking", id: d.id }, amount: d.amount, currency: config.currency, method: d.method, payment_type: d.payment_type, external_reference: d.external_reference }, user.id);
    revalidatePath(`/admin/reservations-salles/${d.id}`);
    return { status: "success", message: "Paiement enregistré." };
  });
}
