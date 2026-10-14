"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { audit } from "@/server/audit";
import { loadSettings, updateSettings, validTimeZone } from "@/server/settings";
import { storeImage, UploadError } from "@/server/uploads";
import { normalizePhone } from "@/lib/contact-links";
import type { FormState } from "@/lib/validation/common";

const text = (max: number) => z.string().trim().max(max).default("");
const url = z.string().trim().max(300).default("").refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Adresse web invalide (doit commencer par https://).");
const coord = (limit: number) => z.string().trim().default("").refine((v) => v === "" || (/^-?\d+(\.\d+)?$/.test(v) && Math.abs(Number(v)) <= limit), "Coordonnée invalide.");

const schema = z
  .object({
    "establishment.name": text(120),
    "establishment.tagline": text(200),
    "establishment.timezone": z.string().trim().default("").refine((v) => v === "" || validTimeZone(v) !== null, "Fuseau inconnu (exemples : Africa/Abidjan, Africa/Douala)."),
    "contact.phone": z.string().trim().default("").refine((v) => v === "" || normalizePhone(v) !== null, "Numéro invalide."),
    "contact.whatsapp": z.string().trim().default("").refine((v) => v === "" || normalizePhone(v)?.startsWith("+"), "Format international requis (ex. +XXX…)."),
    "contact.email": z.string().trim().default("").refine((v) => v === "" || z.string().email().safeParse(v).success, "Adresse invalide."),
    "address.street": text(200),
    "address.city": text(100),
    "address.region": text(100),
    "address.country": text(100),
    "address.directions": text(1500),
    "geo.latitude": coord(90),
    "geo.longitude": coord(180),
    "geo.verified": z.literal("on").optional(),
    "hours.reception": text(500),
    "legal.company_name": text(200),
    "legal.legal_form": text(100),
    "legal.registration_number": text(100),
    "legal.tax_id": text(100),
    "legal.publication_director": text(150),
    "legal.hosting_provider": text(300),
    "legal.validated": z.literal("on").optional(),
    "commerce.currency": z.string().trim().toUpperCase().default("").refine((v) => v === "" || /^[A-Z]{3}$/.test(v), "Code ISO à 3 lettres (ex. XOF, XAF, EUR)."),
    "commerce.payment_methods": text(300),
    "social.facebook": url,
    "social.instagram": url,
    "social.linkedin": url,
  })
  .refine((d) => !d["geo.verified"] || (d["geo.latitude"] && d["geo.longitude"]), { path: ["geo.verified"], message: "Renseignez la latitude et la longitude avant de les déclarer vérifiées." });

export async function saveSettings(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("settings.manage", fd, schema, async (d, user) => {
    const before = await loadSettings();
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(d)) values[k] = k === "geo.verified" || k === "legal.validated" ? (v === "on" ? "true" : "false") : String(v ?? "");
    await updateSettings(values, user.id);
    const changed = Object.keys(values).filter((k) => (before[k] ?? "") !== values[k]);
    await audit({ actorId: user.id, action: "settings.updated", entityType: "settings", details: { changed } });
    revalidatePath("/", "layout");
    return { status: "success", message: changed.length ? `Paramètres enregistrés (${changed.length} modification(s)).` : "Aucune modification." };
  });
}

export async function uploadLogo(_p: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("logo");
  return adminAction("settings.manage", fd, z.object({ remove: z.string().optional() }), async (d, user) => {
    if (d.remove === "1") {
      await updateSettings({ "establishment.logo_path": "" }, user.id);
    } else {
      if (!(file instanceof File)) return { status: "error", message: "Choisissez une image." };
      try {
        const stored = await storeImage(file);
        await updateSettings({ "establishment.logo_path": stored.filePath }, user.id);
      } catch (err) {
        if (err instanceof UploadError) return { status: "error", message: err.message };
        throw err;
      }
    }
    await audit({ actorId: user.id, action: "settings.logo", entityType: "settings" });
    revalidatePath("/", "layout");
    return { status: "success", message: d.remove === "1" ? "Logo retiré : le logotype textuel provisoire est affiché." : "Logo enregistré." };
  });
}
