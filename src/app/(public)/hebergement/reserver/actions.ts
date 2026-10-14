"use server";

import { redirect } from "next/navigation";
import { roomBookingSchema } from "@/lib/validation/public-forms";
import type { FormState } from "@/lib/validation/common";
import { parsePublicForm } from "@/server/public-form";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { createRoomReservation, RoomBookingError } from "@/server/booking/rooms";
import { activePaymentProvider } from "@/server/payments/registry";
import { startRoomReservationPayment } from "@/server/payments/service";
import { PaymentProviderError } from "@/server/payments/types";
import { sendMail, notifyStaff } from "@/server/email/mailer";
import { getSiteConfig } from "@/server/settings";
import { formatDate, formatMoney } from "@/lib/format";

export async function submitRoomBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = await parsePublicForm("room_booking", fd, roomBookingSchema, RATE_LIMITS.roomBooking);
  if (!parsed.ok) return parsed.state;
  const d = parsed.data;
  const config = await getSiteConfig();

  let target: string;
  try {
    const res = await createRoomReservation(d, config);
    const statusUrl = `/hebergement/reservation/${res.reference}?t=${res.accessToken}`;
    target = statusUrl;

    const amount = formatMoney(res.total, res.currency) ?? `${res.total} ${res.currency}`;
    await notifyStaff(`Nouvelle réservation de chambre ${res.reference}`, `${d.full_name} — ${d.phone} — ${d.email}\nDu ${formatDate(d.check_in)} au ${formatDate(d.check_out)}\nMontant : ${amount}\nStatut : ${res.status}\n\n${config.siteUrl}/admin/hebergement/reservations`);
    if (res.status === "pending_confirmation") {
      await sendMail({
        to: d.email,
        subject: `Demande de réservation ${res.reference} reçue`,
        text: `Bonjour ${d.full_name},\n\nNous avons bien reçu votre demande de réservation ${res.reference} du ${formatDate(d.check_in)} au ${formatDate(d.check_out)} (${amount}).\nElle est EN ATTENTE DE CONFIRMATION : notre équipe vous contactera pour la confirmer.\n\nSuivi : ${config.siteUrl}${statusUrl}\n\n${config.displayName}`,
      });
    }

    if (res.status === "pending_payment") {
      const provider = activePaymentProvider();
      if (!provider) throw new PaymentProviderError("Paiement en ligne indisponible.");
      const pay = await startRoomReservationPayment(res.id, provider, statusUrl);
      target = pay.redirectUrl;
    }
  } catch (err) {
    if (err instanceof RoomBookingError || err instanceof PaymentProviderError) {
      return { status: "error", message: err.message, data: err instanceof RoomBookingError && err.extra.total ? { newTotal: err.extra.total } : undefined };
    }
    console.error("[réservation] erreur :", err);
    return { status: "error", message: "La réservation n'a pas pu être enregistrée suite à un incident technique. Aucun montant n'a été débité. Réessayez dans quelques minutes." };
  }
  redirect(target);
}
