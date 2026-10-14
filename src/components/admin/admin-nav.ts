import type { Permission } from "@/server/auth/permissions";

export const ADMIN_NAV: { href: string; label: string; permission: Permission | null; group: string }[] = [
  { href: "/admin", label: "Tableau de bord", permission: "dashboard.view", group: "Suivi" },
  { href: "/admin/demandes", label: "Demandes de devis", permission: "quotes.view", group: "Suivi" },
  { href: "/admin/messages", label: "Messages", permission: "messages.view", group: "Suivi" },
  { href: "/admin/reservations-salles", label: "Réservations de salles", permission: "venue_bookings.view", group: "Exploitation" },
  { href: "/admin/hebergement", label: "Hébergement", permission: "rooms.view", group: "Exploitation" },
  { href: "/admin/paiements", label: "Paiements", permission: "payments.view", group: "Exploitation" },
  { href: "/admin/salles", label: "Fiches des salles", permission: "venues.manage", group: "Contenu" },
  { href: "/admin/services", label: "Services", permission: "content.manage", group: "Contenu" },
  { href: "/admin/medias", label: "Photos", permission: "content.manage", group: "Contenu" },
  { href: "/admin/contenus", label: "Textes et FAQ", permission: "content.manage", group: "Contenu" },
  { href: "/admin/parametres", label: "Paramètres", permission: "settings.manage", group: "Administration" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", permission: "users.manage", group: "Administration" },
  { href: "/admin/journal", label: "Journal", permission: "audit.view", group: "Administration" },
];
