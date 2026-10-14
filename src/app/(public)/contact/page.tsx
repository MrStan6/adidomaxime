import type { Metadata } from "next";
import Link from "next/link";
import { ContactActions } from "@/components/public/ContactActions";
import { ContactForm } from "@/components/public/ContactForm";
import { MapEmbed } from "@/components/public/MapEmbed";
import { Icon } from "@/components/ui/Icon";
import { mailtoLink, telLink } from "@/lib/contact-links";
import { paragraphs } from "@/lib/format";
import { getContent } from "@/server/content";
import { listPublishedFaqs } from "@/server/repositories/faqs";
import { issueFormToken } from "@/server/security/form-guard";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = {
  title: "Contact et accès",
  description: "Contactez l'établissement : formulaire, téléphone, WhatsApp, adresse et informations pratiques.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ sujet?: string }> }) {
  const [config, practical, { sujet }, faqs] = await Promise.all([getSiteConfig(), getContent("contact.practical"), searchParams, listPublishedFaqs()]);
  const tel = telLink(config.phone);
  const mail = mailtoLink(config.email);
  const rows = [
    { icon: "phone", label: "Téléphone", value: config.phone, href: tel },
    { icon: "mail", label: "Courriel", value: config.email, href: mail },
    { icon: "pin", label: "Adresse", value: config.fullAddress, href: null },
    { icon: "clock", label: "Horaires d'accueil", value: config.hours, href: null },
  ];
  return (
    <div className="wrap grid gap-14 py-12 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:py-16">
      <div>
        <h1 className="text-4xl text-earth sm:text-5xl">Contact et accès</h1>
        <p className="measure mt-4 text-lg text-ink-soft">
          Une question sur nos salles, un événement ou l'hébergement ? Écrivez-nous. Pour un événement précis, la{" "}
          <Link href="/devis" className="link">demande de devis</Link> est le moyen le plus rapide.
        </p>
        <dl className="mt-10 space-y-5">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-4">
              <Icon name={r.icon} className="mt-0.5 h-6 w-6 shrink-0 text-terracotta" />
              <div>
                <dt className="font-semibold">{r.label}</dt>
                <dd className="whitespace-pre-line text-ink-soft">
                  {r.value ? (r.href ? <a href={r.href} className="link">{r.value}</a> : r.value) : "À confirmer prochainement"}
                </dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-8"><ContactActions config={config} intent="general" /></div>
        {config.address.directions && (
          <div className="mt-10">
            <h2 className="text-2xl text-earth">Comment venir</h2>
            <p className="mt-3 whitespace-pre-line">{config.address.directions}</p>
          </div>
        )}
        {practical.body && (
          <div className="mt-10">
            <h2 className="text-2xl text-earth">{practical.title || "Informations pratiques"}</h2>
            <div className="mt-3 space-y-3">{paragraphs(practical.body).map((p, i) => <p key={i}>{p}</p>)}</div>
          </div>
        )}
        {config.geo && config.fullAddress && <div className="mt-10"><MapEmbed geo={config.geo} label={config.displayName} /></div>}
      </div>
      <div className="lg:pt-4">
        <div className="rounded-lg border border-line bg-white p-6 sm:p-8">
          <h2 className="text-2xl text-earth">Nous écrire</h2>
          <div className="mt-6"><ContactForm token={issueFormToken("contact")} defaultTopic={sujet} /></div>
        </div>
        {faqs.length > 0 && (
          <section className="mt-12" aria-labelledby="faq-titre">
            <h2 id="faq-titre" className="text-2xl text-earth">Questions fréquentes</h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {faqs.map((f) => (
                <details key={f.id} className="group py-4">
                  <summary className="cursor-pointer font-semibold">{f.question}</summary>
                  <div className="mt-2 space-y-2 text-ink-soft">{paragraphs(f.answer).map((p, i) => <p key={i}>{p}</p>)}</div>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
