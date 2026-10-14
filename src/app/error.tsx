"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-5 py-16">
      <h1 className="text-4xl text-earth">Cette page n'a pas pu s'afficher</h1>
      <p className="mt-4 text-lg text-ink-soft">Un incident technique empêche son chargement. Réessayez ; si le problème persiste, revenez un peu plus tard.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={reset} className="btn btn-primary">Réessayer</button>
        <Link href="/" className="btn btn-secondary">Retour à l'accueil</Link>
      </div>
    </main>
  );
}
