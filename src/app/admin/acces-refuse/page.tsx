import Link from "next/link";
import { requireUser } from "@/server/auth/current-user";

export default async function ForbiddenPage() {
  await requireUser();
  return (
    <main className="mx-auto max-w-lg px-5 py-20">
      <h1 className="text-3xl text-earth">Accès non autorisé</h1>
      <p className="mt-4 text-ink-soft">Votre rôle ne permet pas d'accéder à cette page ou d'effectuer cette action. Si vous en avez besoin, adressez-vous à un administrateur.</p>
      <Link href="/admin" className="btn btn-primary mt-8">Retour au tableau de bord</Link>
    </main>
  );
}
