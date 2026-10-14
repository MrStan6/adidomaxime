import Link from "next/link";
import type { SiteConfig } from "@/server/settings";
import { telLink, mailtoLink } from "@/lib/contact-links";
import { Wordmark } from "./SiteHeader";
import { PUBLIC_NAV } from "./nav";

export function SiteFooter({ config }: { config: SiteConfig }) {
  const tel = telLink(config.phone);
  const mail = mailtoLink(config.email);
  const socials = [
    ["Facebook", config.social.facebook],
    ["Instagram", config.social.instagram],
    ["LinkedIn", config.social.linkedin],
  ].filter((s): s is [string, string] => !!s[1] && /^https:\/\//.test(s[1]));
  const hasCoords = tel || mail || config.fullAddress || config.hours;

  return (
    <footer className="on-dark bg-ink text-sand-light">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Wordmark config={config} light />
          {config.tagline && <p className="mt-4 max-w-sm text-sand/80">{config.tagline}</p>}
          <div className="mt-6 space-y-1.5 text-[0.95rem]">
            {config.fullAddress && <p>{config.fullAddress}</p>}
            {tel && <p><a href={tel} className="underline-offset-4 hover:underline">{config.phone}</a></p>}
            {mail && <p><a href={mail} className="underline-offset-4 hover:underline">{config.email}</a></p>}
            {config.hours && <p className="whitespace-pre-line text-sand/80">{config.hours}</p>}
            {!hasCoords && <p className="text-sand/70">Coordonnées en cours de confirmation. Utilisez le <Link href="/contact" className="underline">formulaire de contact</Link>.</p>}
          </div>
        </div>
        <nav aria-label="Pied de page">
          <h2 className="font-sans text-sm font-semibold text-gold">Le site</h2>
          <ul className="mt-3 space-y-2">
            {PUBLIC_NAV.map((l) => <li key={l.href}><Link href={l.href} className="hover:underline">{l.label}</Link></li>)}
            <li><Link href="/devis" className="hover:underline">Demander un devis</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="font-sans text-sm font-semibold text-gold">Informations</h2>
          <ul className="mt-3 space-y-2">
            <li><Link href="/mentions-legales" className="hover:underline">Mentions légales</Link></li>
            <li><Link href="/confidentialite" className="hover:underline">Politique de confidentialité</Link></li>
            <li><Link href="/cookies" className="hover:underline">Cookies</Link></li>
            <li><Link href="/conditions-location-salles" className="hover:underline">Conditions de location des salles</Link></li>
            <li><Link href="/conditions-reservation" className="hover:underline">Conditions de réservation</Link></li>
            <li><Link href="/conditions-annulation" className="hover:underline">Conditions d'annulation</Link></li>
          </ul>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-4">
              {socials.map(([label, href]) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{label}</a></li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="wrap py-5 text-sm text-sand/60">© {new Date().getFullYear()} {config.legal.company_name ?? config.displayName}</p>
      </div>
    </footer>
  );
}
