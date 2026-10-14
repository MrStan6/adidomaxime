import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp, { type OutputInfo } from "sharp";
import { env } from "./env";

/**
 * Traitement des photos envoyées :
 *  - vérification du type RÉEL (signature du fichier, pas l'extension) ;
 *  - limite de taille ;
 *  - ré-encodage en WebP (≤ 2400 px) : supprime les métadonnées (GPS,
 *    appareil…) et neutralise un fichier piégé ;
 *  - nom aléatoire, stockage hors du dossier public.
 */
export class UploadError extends Error {}

const SIGNATURES: { type: string; test: (b: Buffer) => boolean }[] = [
  { type: "jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
];

export function detectImageType(buf: Buffer): string | null {
  return SIGNATURES.find((s) => s.test(buf))?.type ?? null;
}

export async function storeImage(file: File): Promise<{ filePath: string; width: number; height: number }> {
  // Sur Vercel, le disque est éphémère : une photo enregistrée disparaîtrait.
  // On refuse plutôt que de donner l'illusion d'un envoi réussi.
  if (process.env.VERCEL) {
    throw new UploadError("L'envoi de photos n'est pas disponible sur cet aperçu en ligne (stockage non persistant). Il le sera sur l'hébergement définitif.");
  }
  const max = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (!file || file.size === 0) throw new UploadError("Choisissez une image.");
  if (file.size > max) throw new UploadError(`Image trop lourde (maximum ${env().UPLOAD_MAX_MB} Mo).`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!detectImageType(buf)) throw new UploadError("Format non accepté : utilisez une photo JPEG, PNG ou WebP.");
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(buf, { limitInputPixels: 60_000_000 })
      .rotate() // applique l'orientation EXIF avant suppression des métadonnées
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("Image illisible ou endommagée.");
  }
  const now = new Date();
  const rel = path.posix.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), `${randomUUID()}.webp`);
  const abs = path.resolve(env().UPLOAD_DIR, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, out.data, { mode: 0o640 });
  return { filePath: rel, width: out.info.width, height: out.info.height };
}

export async function removeStoredImage(rel: string) {
  if (rel.startsWith("/")) return; // visuel provisoire statique : jamais supprimé du disque
  const root = path.resolve(env().UPLOAD_DIR);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return;
  await unlink(abs).catch(() => undefined);
}
