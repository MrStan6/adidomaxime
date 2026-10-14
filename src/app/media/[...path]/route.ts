import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/**
 * Sert les photos envoyées depuis l'administration (stockées hors du code,
 * dans UPLOAD_DIR). Protection contre la traversée de répertoires.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.some((p) => p === ".." || p.includes("\0") || p.startsWith("."))) return new Response("Not found", { status: 404 });
  const root = path.resolve(env().UPLOAD_DIR);
  const file = path.resolve(root, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const s = await stat(file);
    if (!s.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(s.size),
        // les noms de fichiers sont uniques : cache long possible
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
