import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion à l'administration", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-light px-5 py-12">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-7 shadow-sm">
        <h1 className="text-3xl text-earth">Administration</h1>
        <p className="mt-2 text-ink-soft">Accès réservé à l'équipe de l'établissement.</p>
        <div className="mt-7"><LoginForm /></div>
        <p className="mt-6 text-sm text-ink-soft">Mot de passe oublié ? Demandez à un administrateur de le réinitialiser.</p>
      </div>
    </main>
  );
}
