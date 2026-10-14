"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../ui/Icon";

// Pages où la barre ferait doublon avec un formulaire déjà affiché.
const HIDDEN_ON = ["/devis", "/contact", "/hebergement/reserver", "/paiement"];

export function StickyMobileCtaBar({ whatsapp, tel }: { whatsapp: string | null; tel: string | null }) {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
      <Link href="/devis" className="btn btn-primary flex-1">Demander un devis</Link>
      {whatsapp ? (
        <a href={whatsapp} className="btn btn-whatsapp px-4" target="_blank" rel="noopener noreferrer" aria-label="Écrire sur WhatsApp">
          <Icon name="whatsapp" className="h-6 w-6" />
        </a>
      ) : tel ? (
        <a href={tel} className="btn btn-secondary px-4" aria-label="Appeler">
          <Icon name="phone" className="h-6 w-6" />
        </a>
      ) : null}
    </div>
  );
}
