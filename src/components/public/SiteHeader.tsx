import Link from "next/link";
import Image from "next/image";
import type { SiteConfig } from "@/server/settings";
import { mediaUrl } from "@/lib/media-url";
import { MobileNav } from "./MobileNav";
import { PUBLIC_NAV } from "./nav";

/**
 * Logotype textuel TEMPORAIRE tant qu'aucun logo officiel n'est fourni
 * (paramètre establishment.logo_path).
 */
export function Wordmark({ config, light = false }: { config: SiteConfig; light?: boolean }) {
  if (config.logoPath) {
    return <Image src={mediaUrl(config.logoPath)} alt={config.displayName} width={160} height={48} className="h-10 w-auto" unoptimized={config.logoPath.endsWith(".svg")} />;
  }
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 40" className="h-9 w-7 shrink-0" aria-hidden>
        <path d="M2 40V16a14 14 0 0 1 28 0v24" fill="none" stroke={light ? "#d4af37" : "#5a3a1e"} strokeWidth="2.5" />
        <path d="M10 40V20a6 6 0 0 1 12 0v20" fill={light ? "#d4af37" : "#a0522d"} opacity=".85" />
      </svg>
      <span className={`font-display text-[1.35rem] leading-none ${light ? "text-paper" : "text-earth"}`}>{config.displayName}</span>
    </span>
  );
}

export function SiteHeader({ config }: { config: SiteConfig }) {
  return (
    <header className="relative z-40 border-b border-line bg-paper">
      <div className="wrap flex h-[4.5rem] items-center justify-between gap-6">
        <Link href="/" className="no-underline" aria-label={`${config.displayName} — accueil`}>
          <Wordmark config={config} />
        </Link>
        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-[0.97rem]">
            {PUBLIC_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="py-2 no-underline hover:text-terracotta">{l.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/devis" className="btn btn-primary btn-sm hidden sm:inline-flex">Demander un devis</Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
