import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent, LEGAL_PAGES, type LegalSlug } from "@/server/content";
import { getSiteConfig } from "@/server/settings";
import { paragraphs } from "@/lib/format";

type Props = { params: Promise<{ legal: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(LEGAL_PAGES).map((legal) => ({ legal }));
}

async function load(slug: string) {
  if (!(slug in LEGAL_PAGES)) return null;
  return getContent(LEGAL_PAGES[slug as LegalSlug]);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const block = await load((await params).legal);
  return block ? { title: block.title, alternates: { canonical: `/${(await params).legal}` } } : {};
}

export default async function LegalPage({ params }: Props) {
  const { legal } = await params;
  const [block, config] = await Promise.all([load(legal), getSiteConfig()]);
  if (!block) notFound();
  const needsValidation = !config.legal.validated || /À RENSEIGNER|MODÈLE À/i.test(block.body);
  return (
    <article className="wrap py-12 lg:py-16">
      <h1 className="text-4xl text-earth sm:text-5xl">{block.title}</h1>
      {needsValidation && (
        <p role="note" className="measure mt-6 rounded-md border border-warn/30 bg-[#f8efdc] p-4 text-[0.95rem] text-warn">
          Document en cours de finalisation : son contenu doit encore être complété et validé par l'établissement.
        </p>
      )}
      <div className="measure prose-text mt-8 whitespace-pre-line">
        {paragraphs(block.body).map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </article>
  );
}
