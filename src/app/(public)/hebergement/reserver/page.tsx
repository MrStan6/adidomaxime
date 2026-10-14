import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoomBookingForm } from "@/components/public/RoomBookingForm";
import { RoomTypeFacts } from "@/components/public/RoomTypeCard";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney, paragraphs } from "@/lib/format";
import { roomSearchSchema } from "@/lib/validation/public-forms";
import { bookingReadiness, fitsCapacity, getRoomType, priceStay } from "@/server/booking/rooms";
import { activePaymentProvider } from "@/server/payments/registry";
import { issueFormToken } from "@/server/security/form-guard";
import { getSiteConfig } from "@/server/settings";

export const metadata: Metadata = { title: "Finaliser la réservation", robots: { index: false } };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const config = await getSiteConfig();
  if (!(await bookingReadiness(config)).ready) redirect("/hebergement");
  const sp = await searchParams;
  const parsed = roomSearchSchema.safeParse(sp);
  const rt = parsed.success && /^[0-9a-f-]{36}$/.test(sp.room_type_id ?? "") ? await getRoomType(sp.room_type_id!) : null;
  if (!parsed.success || !rt || !rt.is_published) redirect("/hebergement");
  const p = parsed.data;
  const quote = fitsCapacity(rt, p.adults, p.children, p.rooms) ? await priceStay(rt.id, p.check_in, p.check_out, p.rooms) : null;
  if (!quote) redirect(`/hebergement/recherche?${new URLSearchParams(sp)}`);
  const online = config.rooms.paymentMode === "online";
  const provider = online ? activePaymentProvider() : null;

  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[1fr_22rem]">
      <div className="max-w-2xl">
        <h1 className="text-4xl text-earth">Vos informations</h1>
        <p className="mt-3 text-ink-soft">Aucun compte n'est nécessaire.</p>
        <div className="mt-8">
          <RoomBookingForm
            token={issueFormToken("room_booking")}
            hidden={{ room_type_id: rt.id, check_in: p.check_in, check_out: p.check_out, adults: String(p.adults), children: String(p.children), rooms: String(p.rooms), expected_total: quote.total }}
            submitLabel={online ? "Confirmer et payer" : "Envoyer ma demande de réservation"}
          />
        </div>
      </div>
      <aside className="h-fit rounded-lg bg-sand-light p-6 lg:sticky lg:top-6">
        <h2 className="font-sans text-lg font-semibold">Récapitulatif</h2>
        <p className="mt-3 font-display text-2xl text-earth">{rt.name}</p>
        {rt.is_demo && <p className="mt-1"><Badge tone="warning">Exemple de démonstration</Badge></p>}
        <div className="mt-3"><RoomTypeFacts rt={rt} /></div>
        <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[0.95rem]">
          <div className="flex justify-between gap-4"><dt>Arrivée</dt><dd>{formatDate(p.check_in)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Départ</dt><dd>{formatDate(p.check_out)}</dd></div>
          <div className="flex justify-between gap-4"><dt>Voyageurs</dt><dd>{p.adults} adulte(s){p.children ? `, ${p.children} enfant(s)` : ""}</dd></div>
          <div className="flex justify-between gap-4"><dt>Chambres</dt><dd>{p.rooms}</dd></div>
          <div className="flex justify-between gap-4"><dt>Nuits</dt><dd>{quote.nights}</dd></div>
          <div className="flex justify-between gap-4 border-t border-line pt-3 text-lg font-semibold"><dt>Total</dt><dd>{formatMoney(quote.total, quote.currency)}</dd></div>
        </dl>
        <p className="mt-4 text-sm text-ink-soft">
          {online
            ? `Paiement sécurisé sur la page du prestataire${provider?.isDemo ? " (DÉMONSTRATION : aucun débit réel)" : ""}. Les chambres sont réservées pour vous ${config.rooms.holdMinutes} minutes le temps du paiement. La réservation est confirmée uniquement après validation du paiement par le prestataire.`
            : "Aucun paiement en ligne : votre demande sera confirmée par notre équipe, qui vous indiquera les modalités de règlement."}
        </p>
        {rt.cancellation_policy && (
          <div className="mt-4 border-t border-line pt-4 text-sm">
            <h3 className="font-semibold">Annulation</h3>
            {paragraphs(rt.cancellation_policy).map((t, i) => <p key={i} className="mt-1">{t}</p>)}
          </div>
        )}
        <Link href={`/hebergement/recherche?${new URLSearchParams(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])))}`} className="link mt-4 inline-block text-sm">Modifier la recherche</Link>
      </aside>
    </div>
  );
}
