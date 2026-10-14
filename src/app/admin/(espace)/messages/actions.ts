"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { setContactStatus } from "@/server/repositories/contact";
import type { FormState } from "@/lib/validation/common";

const schema = z.object({ id: z.string().uuid(), status: z.enum(["new", "handled", "archived"]) });

export async function updateMessageStatus(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("messages.manage", fd, schema, async (d, user) => {
    await setContactStatus(d.id, d.status, user.id);
    revalidatePath("/admin/messages");
    return { status: "success", message: "Message mis à jour." };
  });
}
