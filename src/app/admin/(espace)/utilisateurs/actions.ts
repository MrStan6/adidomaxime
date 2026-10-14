"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction } from "@/server/admin-action";
import { ROLES } from "@/server/auth/permissions";
import { createUser, setUserPassword, updateUserAccess } from "@/server/repositories/users";
import { emailField, requiredText, type FormState } from "@/lib/validation/common";

const tempPassword = () => `${randomBytes(9).toString("base64url")}-${Math.floor(Math.random() * 90 + 10)}`;

export async function inviteUser(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("users.manage", fd, z.object({ email: emailField, full_name: requiredText("Le nom", 2, 120), role: z.enum(ROLES) }), async (d, user) => {
    const password = tempPassword();
    await createUser({ ...d, password, must_change_password: true }, user.id);
    revalidatePath("/admin/utilisateurs");
    return { status: "success", message: `Compte créé. Mot de passe provisoire à transmettre de façon sûre (affiché une seule fois) : ${password}` };
  });
}

export async function updateAccess(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("users.manage", fd, z.object({ id: z.string().uuid(), full_name: requiredText("Le nom", 2, 120), role: z.enum(ROLES), is_active: z.literal("on").optional() }), async (d, user) => {
    await updateUserAccess(d.id, { role: d.role, is_active: d.is_active === "on", full_name: d.full_name }, user.id);
    revalidatePath("/admin/utilisateurs");
    return { status: "success", message: "Accès mis à jour. Les sessions de l'utilisateur ont été fermées si son rôle ou son état a changé." };
  });
}

export async function resetPassword(_p: FormState, fd: FormData): Promise<FormState> {
  return adminAction("users.manage", fd, z.object({ id: z.string().uuid() }), async (d, user) => {
    const password = tempPassword();
    await setUserPassword(d.id, password, true, user.id);
    return { status: "success", message: `Nouveau mot de passe provisoire (affiché une seule fois) : ${password}` };
  });
}
