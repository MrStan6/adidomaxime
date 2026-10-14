"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate } from "@/server/auth/login";
import { createSession, destroySession } from "@/server/auth/session";
import { SESSION_COOKIE, sessionCookieOptions, getCurrentUser } from "@/server/auth/current-user";
import { clientFingerprint, userAgent } from "@/server/security/request";
import { audit } from "@/server/audit";
import type { FormState } from "@/lib/validation/common";

const loginSchema = z.object({ email: z.string().trim().min(1).max(160), password: z.string().min(1).max(200) });

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { status: "error", message: "Saisissez votre adresse et votre mot de passe." };
  const ip = await clientFingerprint();
  const result = await authenticate(parsed.data.email, parsed.data.password, ip);
  if (!result.ok) {
    return {
      status: "error",
      message: result.error === "rate_limited"
        ? "Trop de tentatives. Patientez 15 minutes avant de réessayer, ou contactez un administrateur."
        : "Adresse ou mot de passe incorrect.",
    };
  }
  const { token, expiresAt } = await createSession(result.userId, { ipHash: ip, userAgent: await userAgent() });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  redirect("/admin");
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUser();
  if (token) await destroySession(token);
  if (user) await audit({ actorId: user.id, action: "auth.logout", entityType: "user", entityId: user.id });
  jar.delete(SESSION_COOKIE);
  redirect("/admin/connexion");
}
