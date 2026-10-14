"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { PUBLIC_NAV } from "./nav";

/** Menu mobile accessible (bouton, Échap pour fermer, fermeture à la navigation). */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex h-12 w-12 items-center justify-center rounded-md text-ink"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? "close" : "menu"} className="h-6 w-6" />
        <span className="sr-only">{open ? "Fermer le menu" : "Ouvrir le menu"}</span>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Navigation principale" className="absolute inset-x-0 top-full border-b border-line bg-paper shadow-sm">
          <ul className="wrap flex flex-col py-2">
            {PUBLIC_NAV.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-12 items-center border-b border-sand py-2 text-lg" aria-current={pathname.startsWith(l.href) ? "page" : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="py-4">
              <Link href="/devis" className="btn btn-primary w-full">Demander un devis</Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
