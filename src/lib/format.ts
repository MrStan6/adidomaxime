/** Fonctions de formatage (français). Utilisables côté client et serveur. */

const TZ = "UTC"; // les dates calendaires (YYYY-MM-DD) sont traitées sans fuseau

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseDateOnly(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ, ...opts }).format(d);
}

export function formatDateShort(value: string | Date | null | undefined): string {
  return formatDate(value, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Date et heure dans le fuseau de l'établissement. */
export function formatDateTime(value: string | Date | null | undefined, timeZone?: string): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(d);
}

/** Parse « YYYY-MM-DD » en minuit UTC (évite les décalages de fuseau). */
export function parseDateOnly(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return new Date(s);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((parseDateOnly(checkOut).getTime() - parseDateOnly(checkIn).getTime()) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = parseDateOnly(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

/**
 * Formate un montant. Retourne null si la devise n'est pas configurée :
 * on n'affiche jamais un prix sans devise confirmée.
 */
export function formatMoney(amount: number | string | null | undefined, currency: string | null | undefined): string | null {
  if (amount === null || amount === undefined || amount === "" || !currency) return null;
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toLocaleString("fr-FR")} ${currency}`;
  }
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Découpe un texte en paragraphes (lignes vides). */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Lit une liste « Titre | Texte » (une entrée par ligne). */
export function parseTitledList(text: string): { title: string; text: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, ...rest] = l.split("|");
      return { title: (title ?? "").trim(), text: rest.join("|").trim() };
    })
    .filter((x) => x.title);
}
