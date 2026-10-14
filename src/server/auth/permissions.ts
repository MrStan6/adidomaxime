/**
 * Matrice des rôles et permissions (principe du moindre privilège).
 * Toute opération sensible vérifie une permission CÔTÉ SERVEUR via
 * requirePermission() — masquer un bouton ne suffit jamais.
 */
export const ROLES = ["admin", "commercial", "reception", "comptabilite"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "finance.view", // montants, chiffre d'affaires
  "quotes.view",
  "quotes.manage",
  "messages.view",
  "messages.manage",
  "venue_bookings.view",
  "venue_bookings.manage",
  "venues.manage",
  "rooms.view",
  "rooms.manage", // catégories, chambres, tarifs, activation
  "room_reservations.manage",
  "payments.view",
  "payments.manage", // saisie de paiements manuels
  "invoices.manage",
  "content.manage", // textes, FAQ, médias, services
  "settings.manage", // coordonnées, paramètres de l'établissement
  "users.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  commercial: [
    "dashboard.view",
    "finance.view",
    "quotes.view",
    "quotes.manage",
    "messages.view",
    "messages.manage",
    "venue_bookings.view",
    "venue_bookings.manage",
    "venues.manage",
    "rooms.view",
    "content.manage",
  ],
  reception: [
    "dashboard.view",
    "quotes.view",
    "messages.view",
    "messages.manage",
    "venue_bookings.view",
    "rooms.view",
    "room_reservations.manage",
  ],
  comptabilite: [
    "dashboard.view",
    "finance.view",
    "venue_bookings.view",
    "rooms.view",
    "payments.view",
    "payments.manage",
    "invoices.manage",
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return (MATRIX as Record<string, readonly Permission[]>)[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: string): readonly Permission[] {
  return (MATRIX as Record<string, readonly Permission[]>)[role] ?? [];
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
