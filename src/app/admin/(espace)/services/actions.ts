"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { audit } from "@/server/audit";
import { upsertService } from "@/server/repositories/services";
import { requiredText, type FormState } from "@/lib/validation/common";

const schema = z
  .object({
    id: z.string().optional().transform((v) => v || undefined),
    slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Identifiant : minuscules, chiffres et tirets."),
    name: requiredText("Le nom", 2, 100),
    description: requiredText("La description", 5, 600),
    icon: z.string().trim().max(30).default("star"),
    status: z.enum(["planned", "available", "suspended"]),
    is_published: z.literal("on").optional(),
    sort_order: z.coerce.number().int().min(0).max(999),
  })
  .refine((d) => !(d.is_published && d.status !== "available"), {
    path: ["is_published"],
    message: "Seul un service « disponible » peut être publié.",
  });

export async function saveService(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("content.manage", fd, schema, async (d, user) => {
    const r = await upsertService({ ...d, is_published: d.is_published === "on" }, user.id);
    await audit({ actorId: user.id, action: "service.saved", entityType: "service", entityId: r?.id, details: { status: d.status, published: d.is_published === "on" } });
    revalidatePath("/admin/services");
    return { status: "success", message: "Service enregistré." };
  });
}
