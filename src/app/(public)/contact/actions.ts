"use server";

import { contactSchema } from "@/lib/validation/public-forms";
import { contactTopicLabel } from "@/lib/labels";
import type { FormState } from "@/lib/validation/common";
import { parsePublicForm } from "@/server/public-form";
import { RATE_LIMITS } from "@/server/security/rate-limit";
import { createContactMessage } from "@/server/repositories/contact";
import { notifyStaff } from "@/server/email/mailer";
import { getSiteConfig } from "@/server/settings";

export async function submitContact(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = await parsePublicForm("contact", fd, contactSchema, RATE_LIMITS.contactForm);
  if (!parsed.ok) return parsed.state;
  const d = parsed.data;
  try {
    await createContactMessage(d);
    const config = await getSiteConfig();
    await notifyStaff(
      `Nouveau message — ${contactTopicLabel[d.topic]}`,
      `${d.full_name}\n${d.email ?? ""} ${d.phone ?? ""}\n\n${d.message}\n\nÀ traiter : ${config.siteUrl}/admin/messages`,
      d.email,
    );
    return { status: "success", message: "Merci, votre message est bien enregistré. Notre équipe vous répondra dès que possible." };
  } catch (err) {
    console.error("[contact] enregistrement impossible :", err);
    return { status: "error", message: "Votre message n'a pas pu être enregistré suite à un incident technique. Réessayez dans quelques minutes." };
  }
}
