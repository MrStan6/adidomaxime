import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "../env";
import { findSessionUser, type SessionUser } from "./session";
import { hasPermission, type Permission } from "./permissions";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-hotel_session" : "hotel_session";

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env().SITE_URL.startsWith("https://") || process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** Utilisateur connecté (mis en cache pour la durée de la requête). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return findSessionUser(token);
});

/** Exige une session valide, sinon redirige vers la page de connexion. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/connexion");
  return user;
}

/**
 * Exige une permission. À appeler au début de CHAQUE page et action
 * d'administration sensible.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  // Mot de passe provisoire : changement obligatoire avant tout accès.
  if (user.must_change_password) redirect("/admin/compte?premiere=1");
  if (!hasPermission(user.role, permission)) redirect("/admin/acces-refuse");
  return user;
}

export async function can(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user && hasPermission(user.role, permission);
}
