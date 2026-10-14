"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/current-user";
import { passwordSchema, verifyPassword } from "@/server/auth/password";
import { getPasswordHash, setUserPassword } from "@/server/repositories/users";
import { fieldErrors, type FormState } from "@/lib/validation/common";

const schema = z
  .object({ current: z.string().min(1, "Saisissez votre mot de passe actuel."), next: passwordSchema, confirm: z.string() })
  .refine((d) => d.next === d.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." })
  .refine((d) => d.next !== d.current, { path: ["next"], message: "Choisissez un mot de passe différent de l'actuel." });

export async function changePassword(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { status: "error", message: "Certains champs sont à corriger.", errors: fieldErrors(parsed.error) };
  const hash = await getPasswordHash(user.id);
  if (!hash || !(await verifyPassword(parsed.data.current, hash))) return { status: "error", errors: { current: "Mot de passe actuel incorrect." } , message: "Certains champs sont à corriger." };
  await setUserPassword(user.id, parsed.data.next, false, user.id, user.session_id);
  if (user.must_change_password) redirect("/admin");
  return { status: "success", message: "Mot de passe modifié. Vos autres sessions ont été fermées." };
}
