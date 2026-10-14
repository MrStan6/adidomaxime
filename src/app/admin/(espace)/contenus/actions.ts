"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { requirePermission } from "@/server/auth/current-user";
import { audit } from "@/server/audit";
import { updateContentBlock } from "@/server/content";
import { deleteFaq, upsertFaq } from "@/server/repositories/faqs";
import { requiredText, type FormState } from "@/lib/validation/common";

const blockSchema = z.object({
  key: z.string().regex(/^[a-z_]+\.[a-z_]+$/),
  title: z.string().trim().max(200),
  body: z.string().max(20000),
});

export async function saveBlock(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("content.manage", fd, blockSchema, async (d, user) => {
    const ok = await updateContentBlock(d.key, d.title, d.body.replace(/\r\n/g, "\n"), user.id);
    if (!ok) return { status: "error", message: "Bloc introuvable." };
    await audit({ actorId: user.id, action: "content.updated", entityType: "content_block", entityId: d.key });
    revalidatePath("/admin/contenus");
    return { status: "success", message: "Texte enregistré et publié." };
  });
}

const faqSchema = z.object({
  id: z.string().optional().transform((v) => v || undefined),
  category: z.enum(["general", "salles", "hebergement", "paiement"]),
  question: requiredText("La question", 5, 300),
  answer: requiredText("La réponse", 5, 3000),
  is_published: z.literal("on").optional(),
  sort_order: z.coerce.number().int().min(0).max(999),
});

export async function saveFaq(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("content.manage", fd, faqSchema, async (d, user) => {
    const r = await upsertFaq({ ...d, is_published: d.is_published === "on" });
    await audit({ actorId: user.id, action: "faq.saved", entityType: "faq", entityId: r?.id });
    revalidatePath("/admin/contenus");
    return { status: "success", message: "Question enregistrée." };
  });
}

export async function removeFaq(fd: FormData) {
  const user = await requirePermission("content.manage");
  const id = String(fd.get("id"));
  if (!z.string().uuid().safeParse(id).success) return;
  await deleteFaq(id);
  await audit({ actorId: user.id, action: "faq.deleted", entityType: "faq", entityId: id });
  revalidatePath("/admin/contenus");
}
