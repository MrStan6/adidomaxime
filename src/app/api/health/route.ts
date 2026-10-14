import { queryOne } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Sonde de santé pour le déploiement (healthcheck Docker, supervision,
 * vérification après mise à jour ou retour arrière).
 * Ne divulgue aucune information sensible : uniquement « ok » ou « erreur »
 * et la dernière migration appliquée.
 */
export async function GET() {
  try {
    const row = await queryOne<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1");
    return Response.json({ status: "ok", migration: row?.name ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
