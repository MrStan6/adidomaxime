import type { Metadata } from "next";
import { QuoteForm } from "@/components/public/QuoteForm";
import { ContactActions } from "@/components/public/ContactActions";
import { issueFormToken } from "@/server/security/form-guard";
import { venueOptions } from "@/server/repositories/venues";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = {
  title: "Demander un devis pour une salle",
  description: "Présentez votre événement : date, horaires, nombre de participants et besoins. Notre équipe vous recontacte avec une proposition.",
  alternates: { canonical: "/devis" },
};

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ salle?: string; type?: string }> }) {
  const sp = await searchParams;
  const [config, venues] = await Promise.all([getSiteConfig(), venueOptions(true)]);
  const type = sp.type === "disponibilite" ? "availability" : "quote";
  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[1fr_20rem] lg:py-16">
      <div className="max-w-3xl">
        <h1 className="text-4xl text-earth sm:text-5xl">{type === "availability" ? "Vérifier une disponibilité" : "Demander un devis"}</h1>
        <p className="measure mt-4 text-lg text-ink-soft">
          Quelques informations sur votre événement suffisent. Les champs marqués d'un astérisque sont obligatoires.
        </p>
        <div className="mt-10">
          <QuoteForm venues={venues} defaultVenueSlug={sp.salle} defaultType={type} token={issueFormToken("quote")} />
        </div>
      </div>
      <aside className="space-y-6 lg:pt-28">
        <div className="rounded-lg bg-sand-light p-6">
          <h2 className="font-sans text-lg font-semibold">Comment ça se passe ?</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[0.95rem] text-ink-soft">
            <li>Vous envoyez votre demande.</li>
            <li>Notre équipe vérifie la disponibilité et prépare une proposition.</li>
            <li>Après votre accord et le respect des conditions de réservation, la date vous est confirmée par écrit.</li>
          </ol>
        </div>
        <div>
          <ContactActions config={config} intent="venue_quote" />
        </div>
      </aside>
    </div>
  );
}
