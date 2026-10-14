"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { requirePermission } from "@/server/auth/current-user";
import { audit } from "@/server/audit";
import { deleteMedia, insertMedia, updateMedia } from "@/server/repositories/media";
import { removeStoredImage, storeImage, UploadError } from "@/server/uploads";
import { MEDIA_CATEGORIES } from "@/lib/labels";
import { optionalText, requiredText, type FormState } from "@/lib/validation/common";

const optUuid = z.string().optional().transform((v) => (v ? v : null)).refine((v) => v === null || z.string().uuid().safeParse(v).success, "Sélection invalide.");

const meta = {
  alt: requiredText("Le texte alternatif", 5, 200),
  caption: optionalText(200),
  category: z.enum(MEDIA_CATEGORIES),
  venue_id: optUuid,
  room_type_id: optUuid,
};

export async function uploadMedia(_p: FormState, fd: FormData): Promise<FormState> {
  const file = fd.get("file");
  const schema = z.object({
    ...meta,
    authentic: z.literal("on", { errorMap: () => ({ message: "Confirmez que la photo représente bien l'établissement." }) }),
  });
  return adminAction("content.manage", fd, schema, async (d, user) => {
    if (!(file instanceof File)) return { status: "error", message: "Choisissez une image." };
    try {
      const stored = await storeImage(file);
      const m = await insertMedia({
        file_path: stored.filePath,
        alt: d.alt,
        caption: d.caption ?? null,
        category: d.category,
        venue_id: d.venue_id,
        room_type_id: d.room_type_id,
        width: stored.width,
        height: stored.height,
        uploaded_by: user.id,
      });
      await audit({ actorId: user.id, action: "media.uploaded", entityType: "media", entityId: m!.id, details: { category: d.category } });
    } catch (err) {
      if (err instanceof UploadError) return { status: "error", message: err.message };
      throw err;
    }
    revalidatePath("/admin/medias");
    return { status: "success", message: "Photo ajoutée et publiée." };
  });
}

export async function saveMedia(_p: FormState, fd: FormData): Promise<FormState> {
  const schema = z.object({ id: z.string().uuid(), ...meta, is_published: z.literal("on").optional(), sort_order: z.coerce.number().int().min(0).max(999) });
  return adminAction("content.manage", fd, schema, async (d, user) => {
    await updateMedia(d.id, { ...d, caption: d.caption ?? null, is_published: d.is_published === "on" });
    await audit({ actorId: user.id, action: "media.updated", entityType: "media", entityId: d.id });
    revalidatePath("/admin/medias");
    return { status: "success", message: "Enregistré." };
  });
}

export async function removeMedia(fd: FormData) {
  const user = await requirePermission("content.manage");
  const id = String(fd.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success) return;
  const removed = await deleteMedia(id);
  if (removed) {
    await removeStoredImage(removed.file_path);
    await audit({ actorId: user.id, action: "media.deleted", entityType: "media", entityId: id });
  }
  revalidatePath("/admin/medias");
}
