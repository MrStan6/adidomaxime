"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { audit } from "@/server/audit";
import { bookingReadiness, changeRoomReservationStatus, createRoomBlock, releaseRoomBlock } from "@/server/booking/rooms";
import { addRate, deleteRate, saveRoom, saveRoomType } from "@/server/booking/rooms-admin";
import { recordManualPayment } from "@/server/payments/service";
import { buildSiteConfig, getSiteConfig, loadSettings, updateSettings } from "@/server/settings";
import { PAYMENT_METHODS, ROOM_RESERVATION_STATUSES } from "@/lib/labels";
import { dateField, optionalText, requiredText, type FormState } from "@/lib/validation/common";

const lines = z.string().optional().transform((v) => (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40));
const reval = () => revalidatePath("/admin/hebergement", "layout");

export async function saveLodgingSettings(_p: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({
    public_status: z.enum(["coming_soon", "to_confirm", "open"]),
    booking_enabled: z.literal("on").optional(),
    payment_mode: z.enum(["on_confirmation", "online"]),
    hold_minutes: z.coerce.number().int().min(10).max(1440),
    max_rooms: z.coerce.number().int().min(1).max(10),
  });
  return adminAction("rooms.manage", fd, schema, async (d, user) => {
    const values = {
      "rooms.public_status": d.public_status,
      "rooms.booking_enabled": d.booking_enabled === "on" ? "true" : "false",
      "rooms.payment_mode": d.payment_mode,
      "rooms.hold_minutes": String(d.hold_minutes),
      "rooms.max_rooms_per_booking": String(d.max_rooms),
    };
    if (d.booking_enabled === "on") {
      // Vérification des prérequis AVANT activation (simulation avec les nouvelles valeurs).
      const simulated = buildSiteConfig({ ...(await loadSettings()), ...values });
      const r = await bookingReadiness(simulated);
      if (!r.ready) return { status: "error", message: `Activation impossible : ${r.reasons.join(" ")}` };
    }
    await updateSettings(values, user.id);
    await audit({ actorId: user.id, action: "rooms.settings", entityType: "settings", details: values });
    reval();
    return { status: "success", message: "Paramètres de l'hébergement enregistrés." };
  });
}

const roomTypeSchema = z.object({
  id: z.string().optional().transform((v) => v || null),
  name: requiredText("Le nom", 2, 120),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Minuscules, chiffres et tirets."),
  description: z.string().trim().max(4000).default(""),
  max_adults: z.coerce.number().int().min(1).max(20),
  max_children: z.coerce.number().int().min(0).max(20),
  max_occupancy: z.coerce.number().int().min(1).max(40),
  bed_count: z.coerce.number().int().min(1).max(20),
  bed_description: z.string().trim().max(200).default(""),
  amenities: lines,
  stay_rules: z.string().trim().max(3000).default(""),
  cancellation_policy: z.string().trim().max(3000).default(""),
  is_published: z.literal("on").optional(),
  sort_order: z.coerce.number().int().min(0).max(999),
});

export async function saveCategory(_p: FormState, fd: FormData): Promise<FormState> {
  let newId: string | null = null;
  const res = await adminAction("rooms.manage", fd, roomTypeSchema, async (d, user) => {
    const row = await saveRoomType(d.id, { ...d, is_published: d.is_published === "on" }, user.id);
    if (!d.id) newId = row.id;
    reval();
    return { status: "success", message: "Catégorie enregistrée." };
  });
  if (newId) redirect(`/admin/hebergement/categories/${newId}`);
  return res;
}

export async function addCategoryRate(_p: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({
    room_type_id: z.string().uuid(),
    starts_on: dateField("Le début"),
    ends_on: dateField("La fin"),
    nightly_amount: z.coerce.number({ invalid_type_error: "Montant invalide." }).positive("Montant invalide."),
    label: optionalText(80),
  });
  return adminAction("rooms.manage", fd, schema, async (d, user) => {
    const config = await getSiteConfig();
    if (!config.currency) return { status: "error", message: "Configurez d'abord la devise dans les paramètres." };
    await addRate({ ...d, currency: config.currency, label: d.label ?? null }, user.id);
    reval();
    return { status: "success", message: "Tarif ajouté." };
  });
}

export async function removeRate(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("rooms.manage", fd, z.object({ id: z.string().uuid() }), async (d, user) => {
    await deleteRate(d.id, user.id);
    reval();
    return { status: "success", message: "Tarif supprimé." };
  });
}

export async function saveRoomUnit(_p: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({
    id: z.string().optional().transform((v) => v || null),
    code: requiredText("Le numéro", 1, 20),
    room_type_id: z.string().uuid("Choisissez une catégorie."),
    operational_status: z.enum(["planned", "under_works", "ready", "in_service", "out_of_service"]),
    notes: optionalText(500),
  });
  return adminAction("rooms.manage", fd, schema, async (d, user) => {
    await saveRoom(d.id, { ...d, notes: d.notes ?? null }, user.id);
    reval();
    return { status: "success", message: "Chambre enregistrée." };
  });
}

export async function blockRoom(_p: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({ room_id: z.string().uuid("Choisissez une chambre."), from: dateField("Le début"), to: dateField("La fin"), reason: requiredText("Le motif", 2, 120) });
  return adminAction("room_reservations.manage", fd, schema, async (d, user) => {
    await createRoomBlock(d.room_id, d.from, d.to, d.reason, user.id);
    reval();
    return { status: "success", message: "Chambre bloquée sur la période." };
  });
}

export async function unblockRoom(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("room_reservations.manage", fd, z.object({ id: z.string().uuid() }), async (d, user) => {
    await releaseRoomBlock(d.id, user.id);
    reval();
    return { status: "success", message: "Blocage levé." };
  });
}

export async function changeReservationStatus(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("room_reservations.manage", fd, z.object({ id: z.string().uuid(), to: z.enum(ROOM_RESERVATION_STATUSES), reason: optionalText(500) }), async (d, user) => {
    await changeRoomReservationStatus(d.id, d.to, user.id, d.reason);
    reval();
    return { status: "success", message: "Statut mis à jour." };
  });
}

export async function recordRoomPayment(_p: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({
    id: z.string().uuid(),
    amount: z.coerce.number().positive("Montant invalide."),
    method: z.enum(PAYMENT_METHODS),
    payment_type: z.enum(["deposit", "balance", "full", "refund"]),
    external_reference: optionalText(120),
  });
  return adminAction("payments.manage", fd, schema, async (d, user) => {
    const config = await getSiteConfig();
    if (!config.currency) return { status: "error", message: "Configurez d'abord la devise." };
    await recordManualPayment({ target: { type: "room_reservation", id: d.id }, amount: d.amount, currency: config.currency, method: d.method, payment_type: d.payment_type, external_reference: d.external_reference }, user.id);
    reval();
    return { status: "success", message: "Paiement enregistré." };
  });
}
