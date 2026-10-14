"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { withTransaction, PG, pgErrorCode } from "@/server/db";
import { audit } from "@/server/audit";
import { replaceCapacities, updateVenue } from "@/server/repositories/venues";
import { LAYOUTS } from "@/lib/labels";
import { optionalText, requiredText, type FormState } from "@/lib/validation/common";

const lines = z.string().optional().transform((v) => (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 40));
const optNumber = z.string().optional().transform((v) => (v ? Number(v.replace(",", ".").replace(/\s/g, "")) : null)).refine((v) => v === null || (Number.isFinite(v) && v > 0), "Nombre invalide.");

const venueSchema = z
  .object({
    id: z.string().uuid(),
    name: requiredText("Le nom", 2, 120),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adresse de page : lettres minuscules, chiffres et tirets uniquement."),
    short_description: requiredText("Le résumé", 10, 300),
    description: requiredText("La description", 10, 5000),
    area_m2: optNumber,
    equipment: lines,
    included_services: lines,
    optional_services: lines,
    booking_conditions: optionalText(3000),
    pricing_mode: z.enum(["on_request", "published"]),
    price_amount: optNumber,
    price_unit: optionalText(60),
    is_published: z.literal("on").optional(),
    sort_order: z.coerce.number().int().min(0).max(999),
    cap_other_label: optionalText(60),
  })
  .passthrough() // champs de capacité cap_<config> / val_<config>, validés ci-dessous
  .refine((d) => d.pricing_mode === "on_request" || (d.price_amount && d.price_unit), { path: ["price_amount"], message: "Pour un tarif publié, indiquez le montant et l'unité (ex. « par journée »)." });

export async function saveVenue(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("venues.manage", fd, venueSchema, async (d, user) => {
    const raw = d as Record<string, unknown>;
    const capacities: { layout: (typeof LAYOUTS)[number]; label: string | null; capacity: number; is_validated: boolean }[] = [];
    for (const l of LAYOUTS) {
      const v = String(raw[`cap_${l}`] ?? "").trim();
      if (!v) continue;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return { status: "error" as const, message: "Capacité invalide.", errors: { [`cap_${l}`]: "Nombre entier positif attendu." } };
      capacities.push({ layout: l, label: l === "other" ? (d.cap_other_label ?? "Autre") : null, capacity: n, is_validated: raw[`val_${l}`] === "on" });
    }
    try {
      await withTransaction(async (db) => {
        await updateVenue(d.id, { ...d, booking_conditions: d.booking_conditions ?? "", price_unit: d.price_unit ?? null, is_published: d.is_published === "on" }, db);
        await replaceCapacities(d.id, capacities, db);
        await audit({ actorId: user.id, action: "venue.updated", entityType: "venue", entityId: d.id, details: { name: d.name, pricing_mode: d.pricing_mode, capacities } }, db);
      });
    } catch (err) {
      if (pgErrorCode(err) === PG.UNIQUE_VIOLATION) return { status: "error", message: "Cette adresse de page est déjà utilisée.", errors: { slug: "Déjà utilisée." } };
      throw err;
    }
    revalidatePath("/admin/salles");
    return { status: "success", message: "Fiche enregistrée et publiée sur le site." };
  });
}
