import { query } from "./db";
import type { SiteConfig } from "./settings";

/**
 * Liste des informations encore « À renseigner » avant la mise en
 * production. Affichée dans le tableau de bord et les paramètres.
 */
export async function configChecklist(c: SiteConfig) {
  const venues = await query<{ name: string; caps: string; area: string | null; photos: string }>(
    `SELECT v.name, (SELECT count(*) FROM venue_capacities vc WHERE vc.venue_id = v.id AND vc.is_validated)::text AS caps,
            v.area_m2::text AS area,
            (SELECT count(*) FROM media m WHERE m.venue_id = v.id AND NOT m.is_placeholder AND m.is_published)::text AS photos
       FROM venues v WHERE v.is_published AND NOT v.is_demo ORDER BY v.sort_order`,
  );
  const legal = await query<{ key: string }>("SELECT key FROM content_blocks WHERE key LIKE 'legal.%' AND (body ~* 'À RENSEIGNER|MODÈLE À' OR body = '')");
  const items: { label: string; done: boolean; href: string }[] = [
    { label: "Nom commercial de l'établissement", done: !!c.name, href: "/admin/parametres" },
    { label: "Logo officiel", done: !!c.logoPath, href: "/admin/parametres" },
    { label: "Téléphone officiel", done: !!c.phone, href: "/admin/parametres" },
    { label: "Numéro WhatsApp (format international)", done: !!c.whatsapp, href: "/admin/parametres" },
    { label: "Adresse électronique officielle", done: !!c.email, href: "/admin/parametres" },
    { label: "Adresse postale", done: !!c.fullAddress, href: "/admin/parametres" },
    { label: "Point géographique vérifié", done: !!c.geo, href: "/admin/parametres" },
    { label: "Fuseau horaire", done: c.timezone !== "UTC", href: "/admin/parametres" },
    { label: "Horaires d'accueil", done: !!c.hours, href: "/admin/parametres" },
    { label: "Devise", done: !!c.currency, href: "/admin/parametres" },
    { label: "Informations légales de l'éditeur", done: !!c.legal.company_name && !!c.legal.registration_number, href: "/admin/parametres" },
    { label: "Pages juridiques complétées et validées", done: legal.length === 0 && c.legal.validated, href: "/admin/contenus" },
    ...venues.flatMap((v) => [
      { label: `${v.name} : capacités validées`, done: Number(v.caps) > 0, href: "/admin/salles" },
      { label: `${v.name} : superficie`, done: !!v.area, href: "/admin/salles" },
      { label: `${v.name} : photographies réelles`, done: Number(v.photos) > 0, href: "/admin/medias" },
      { label: `${v.name} : nom définitif`, done: !/provisoire/i.test(v.name), href: "/admin/salles" },
    ]),
  ];
  return { items, remaining: items.filter((i) => !i.done).length };
}
