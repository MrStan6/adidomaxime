import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-5 py-16">
      <p className="font-display text-7xl text-sand">404</p>
      <h1 className="mt-4 text-4xl text-earth">Cette page n'existe pas</h1>
      <p className="mt-4 text-lg text-ink-soft">Le lien est peut-être incomplet ou la page a été déplacée.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">Retour à l'accueil</Link>
        <Link href="/salles" className="btn btn-secondary">Voir les salles</Link>
      </div>
    </main>
  );
}
