import type { Metadata } from "next";
import Link from "next/link";
import { ArchImage } from "@/components/public/ArchImage";
import { PageIntro } from "@/components/public/PageIntro";
import { paragraphs } from "@/lib/format";
import { getContentBlocks } from "@/server/content";
import { listPublishedMedia } from "@/server/repositories/media";

export const metadata: Metadata = {
  title: "L'hôtel",
  description: "Présentation de l'établissement : espaces événementiels disponibles et hébergement en préparation.",
  alternates: { canonical: "/hotel" },
};

export default async function HotelPage() {
  const [c, media] = await Promise.all([getContentBlocks(), listPublishedMedia("etablissement")]);
  const p = c["hotel.presentation"];
  return (
    <>
      <PageIntro title={p?.title || "L'établissement"} />
      <section className="wrap grid gap-12 py-14 lg:grid-cols-[1fr_22rem] lg:gap-20 lg:py-20">
        <div className="space-y-12">
          <div className="measure space-y-4 text-lg">{paragraphs(p?.body ?? "").map((t, i) => <p key={i}>{t}</p>)}</div>
          {["hotel.vision", "hotel.welcome"].map((k) =>
            c[k]?.body ? (
              <div key={k} className="measure border-l-2 border-gold pl-6">
                <h2 className="text-3xl text-earth">{c[k]!.title}</h2>
                <div className="mt-3 space-y-3">{paragraphs(c[k]!.body).map((t, i) => <p key={i}>{t}</p>)}</div>
              </div>
            ) : null,
          )}
          <div className="flex flex-wrap gap-3">
            <Link href="/salles" className="btn btn-primary">Découvrir les salles</Link>
            <Link href="/contact" className="btn btn-secondary">Nous contacter</Link>
          </div>
        </div>
        <ArchImage media={media[0] ?? null} sizes="(min-width: 1024px) 22rem, 90vw" className="max-w-sm" />
      </section>
    </>
  );
}
