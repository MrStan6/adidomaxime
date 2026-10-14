/**
 * Libellés français des statuts et énumérations. Centralisés ici pour
 * garantir des statuts cohérents et faciliter une traduction ultérieure.
 */
export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export const QUOTE_STATUSES = [
  "new",
  "to_process",
  "preparing",
  "sent",
  "negotiation",
  "accepted",
  "refused",
  "cancelled",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const quoteStatusLabel: Record<QuoteStatus, { label: string; tone: Tone }> = {
  new: { label: "Nouveau", tone: "info" },
  to_process: { label: "À traiter", tone: "warning" },
  preparing: { label: "Devis en préparation", tone: "warning" },
  sent: { label: "Devis envoyé", tone: "info" },
  negotiation: { label: "En négociation", tone: "info" },
  accepted: { label: "Accepté", tone: "success" },
  refused: { label: "Refusé", tone: "danger" },
  cancelled: { label: "Annulé", tone: "neutral" },
};
/** Statuts considérés comme « en attente » pour le tableau de bord. */
export const OPEN_QUOTE_STATUSES: QuoteStatus[] = ["new", "to_process", "preparing", "sent", "negotiation"];

export const VENUE_BOOKING_STATUSES = ["option", "confirmed", "completed", "cancelled"] as const;
export type VenueBookingStatus = (typeof VENUE_BOOKING_STATUSES)[number];
export const venueBookingStatusLabel: Record<VenueBookingStatus, { label: string; tone: Tone }> = {
  option: { label: "Option (en attente)", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "success" },
  completed: { label: "Terminée", tone: "neutral" },
  cancelled: { label: "Annulée", tone: "danger" },
};

export const ROOM_RESERVATION_STATUSES = [
  "pending_payment",
  "pending_confirmation",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "expired",
  "no_show",
] as const;
export type RoomReservationStatus = (typeof ROOM_RESERVATION_STATUSES)[number];
export const roomReservationStatusLabel: Record<RoomReservationStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: "En attente de paiement", tone: "warning" },
  pending_confirmation: { label: "En attente de confirmation", tone: "warning" },
  confirmed: { label: "Confirmée", tone: "success" },
  checked_in: { label: "Client arrivé", tone: "info" },
  checked_out: { label: "Séjour terminé", tone: "neutral" },
  cancelled: { label: "Annulée", tone: "danger" },
  expired: { label: "Expirée", tone: "neutral" },
  no_show: { label: "Non présenté", tone: "danger" },
};

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "cancelled", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusLabel: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: "En attente de confirmation", tone: "warning" },
  succeeded: { label: "Paiement confirmé", tone: "success" },
  failed: { label: "Échoué", tone: "danger" },
  cancelled: { label: "Annulé", tone: "neutral" },
  refunded: { label: "Remboursé", tone: "neutral" },
};

export const PAYMENT_METHODS = ["card", "mobile_money", "bank_transfer", "cash", "cheque", "other"] as const;
export const paymentMethodLabel: Record<(typeof PAYMENT_METHODS)[number], string> = {
  card: "Carte bancaire",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  cash: "Espèces",
  cheque: "Chèque",
  other: "Autre",
};

export const LAYOUTS = ["theatre", "classroom", "u_shape", "banquet", "cocktail", "boardroom", "other"] as const;
export type Layout = (typeof LAYOUTS)[number];
export const layoutLabel: Record<Layout, string> = {
  theatre: "Théâtre",
  classroom: "Salle de classe",
  u_shape: "En U",
  banquet: "Banquet",
  cocktail: "Cocktail (debout)",
  boardroom: "Réunion (table unique)",
  other: "Autre",
};

export const EVENT_TYPES = [
  "Conférence",
  "Formation",
  "Séminaire",
  "Réunion",
  "Assemblée générale",
  "Cérémonie familiale",
  "Mariage",
  "Réception",
  "Lancement de produit",
  "Autre",
] as const;

export const EQUIPMENT_OPTIONS = [
  "Vidéoprojecteur et écran",
  "Sonorisation",
  "Microphones",
  "Tableau / paperboard",
  "Connexion internet",
  "Pupitre",
  "Estrade",
] as const;

export const SOURCE_LABEL: Record<string, string> = {
  website: "Site web",
  whatsapp: "WhatsApp",
  phone: "Téléphone",
  email: "Courriel",
  walk_in: "Visite sur place",
  other: "Autre",
};

export const BLOCK_REASON_LABEL: Record<string, string> = {
  maintenance: "Maintenance",
  internal: "Usage interne",
  works: "Travaux",
  other: "Autre",
};

export const ROOM_OPERATIONAL_STATUS_LABEL: Record<string, string> = {
  planned: "Prévue",
  under_works: "En travaux",
  ready: "Prête (non commercialisée)",
  in_service: "En service",
  out_of_service: "Hors service",
};

export const SERVICE_STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  planned: { label: "Envisagé", tone: "neutral" },
  available: { label: "Disponible", tone: "success" },
  suspended: { label: "Suspendu", tone: "warning" },
};

export const MEDIA_CATEGORIES = ["etablissement", "salles", "chambres", "services", "evenements", "autre"] as const;
export const mediaCategoryLabel: Record<(typeof MEDIA_CATEGORIES)[number], string> = {
  etablissement: "L'établissement",
  salles: "Salles",
  chambres: "Chambres",
  services: "Services",
  evenements: "Événements",
  autre: "Autre",
};

export const CONTACT_TOPICS = ["general", "salles", "hebergement", "evenement", "autre"] as const;
export const contactTopicLabel: Record<(typeof CONTACT_TOPICS)[number], string> = {
  general: "Demande générale",
  salles: "Salles événementielles",
  hebergement: "Hébergement",
  evenement: "Informations sur un événement",
  autre: "Autre",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrateur",
  commercial: "Responsable commercial",
  reception: "Réception / réservations",
  comptabilite: "Comptabilité",
};
