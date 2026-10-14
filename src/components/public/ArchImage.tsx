import Image from "next/image";
import { mediaUrl } from "@/lib/media-url";

/**
 * Image dans un cadre en arche (motif signature du site). Les images
 * provisoires portent une mention visible pour ne jamais être prises pour
 * des photographies réelles de l'établissement.
 */
export function ArchImage({
  media,
  sizes = "(min-width: 1024px) 40vw, 100vw",
  priority = false,
  shape = "arch",
  className = "",
}: {
  media: { file_path: string; alt: string; is_placeholder: boolean } | null;
  sizes?: string;
  priority?: boolean;
  shape?: "arch" | "rect";
  className?: string;
}) {
  const src = media ? mediaUrl(media.file_path) : "/placeholders/facade.svg";
  const alt = media?.alt ?? "Image provisoire — photographie à venir";
  const isSvg = src.endsWith(".svg");
  return (
    <figure className={`relative aspect-[4/5] bg-sand ${shape === "arch" ? "arch" : "rounded-md overflow-hidden"} ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={isSvg} className="object-cover" />
      {(!media || media.is_placeholder) && (
        <figcaption className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink/75 px-2 py-0.5 text-xs font-medium text-sand-light">
          Image provisoire
        </figcaption>
      )}
    </figure>
  );
}
