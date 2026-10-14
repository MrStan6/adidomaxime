import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/public/PageIntro";
import { Icon } from "@/components/ui/Icon";
import { getContent } from "@/server/content";
import { listPublicServices } from "@/server/repositories/services";

export const metadata: Metadata = {
  title: "Services",
  description: "Les services disponibles sur place, présentés au fur et à mesure de leur ouverture.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const [intro, services] = await Promise.all([getContent("services.intro"), listPublicServices()]);
  return (
    <>
      <PageIntro title={intro.title || "Services"} body={intro.body} />
      <section className="wrap py-14 lg:py-20">
        {services.length === 0 ? (
          <div className="measure">
            <h2 className="text-3xl text-earth">Les services seront annoncés ici dès leur ouverture</h2>
            <p className="mt-4 text-ink-soft">
              Pour votre événement, précisez vos besoins (restauration, équipement, accueil…) dans votre demande de devis :
              notre équipe vous indiquera ce qui peut être organisé.
            </p>
            <Link href="/devis" className="btn btn-primary mt-8">Demander un devis</Link>
          </div>
        ) : (
          <ul className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {services.map((s) => (
              <li key={s.id} className="flex gap-5 border-t border-line pt-6">
                <Icon name={s.icon} className="h-7 w-7 shrink-0 text-terracotta" />
                <div>
                  <h2 className="font-sans text-xl font-semibold">{s.name}</h2>
                  <p className="mt-2 text-ink-soft">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
