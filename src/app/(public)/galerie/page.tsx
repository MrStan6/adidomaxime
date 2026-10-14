import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PageIntro } from "@/components/public/PageIntro";
import { MEDIA_CATEGORIES, mediaCategoryLabel } from "@/lib/labels";
import { mediaUrl } from "@/lib/media-url";
import { listPublishedMedia } from "@/server/repositories/media";

export const metadata: Metadata = {
  title: "Galerie",
  description: "Photographies de l'établissement et des salles événementielles.",
  alternates: { canonical: "/galerie" },
};

type Cat = (typeof MEDIA_CATEGORIES)[number];

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const active = (MEDIA_CATEGORIES as readonly string[]).includes(categorie ?? "") ? (categorie as Cat) : undefined;
  const all = await listPublishedMedia();
  const present = MEDIA_CATEGORIES.filter((c) => all.some((m) => m.category === c));
  const items = active ? all.filter((m) => m.category === active) : all;
  const onlyPlaceholders = all.length > 0 && all.every((m) => m.is_placeholder);

  return (
    <>
      <PageIntro title="Galerie">
        {onlyPlaceholders && (
          <p className="measure mt-4 text-ink-soft">Les photographies de l'établissement seront publiées prochainement. Les visuels ci-dessous sont provisoires.</p>
        )}
      </PageIntro>
      <section className="wrap py-10 lg:py-14">
        {present.length > 1 && (
          <nav aria-label="Catégories de photographies">
            <ul className="flex flex-wrap gap-2">
              <li><Link href="/galerie" aria-current={!active ? "page" : undefined} className={`btn btn-sm ${!active ? "btn-primary" : "btn-secondary"}`}>Toutes</Link></li>
              {present.map((c) => (
                <li key={c}>
                  <Link href={`/galerie?categorie=${c}`} aria-current={active === c ? "page" : undefined} className={`btn btn-sm ${active === c ? "btn-primary" : "btn-secondary"}`}>
                    {mediaCategoryLabel[c]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {items.length === 0 ? (
          <p className="mt-8 text-ink-soft">Aucune photographie dans cette catégorie pour le moment.</p>
        ) : (
          <ul className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {items.map((m) => {
              const src = mediaUrl(m.file_path);
              return (
                <li key={m.id} className="mb-4 break-inside-avoid">
                  <figure>
                    <a href={src} target="_blank" rel="noopener" className="relative block overflow-hidden rounded-md bg-sand">
                      <Image
                        src={src}
                        alt={m.alt}
                        width={m.width ?? 1200}
                        height={m.height ?? 900}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        unoptimized={src.endsWith(".svg")}
                        className="h-auto w-full"
                      />
                      {m.is_placeholder && <span className="absolute bottom-3 left-3 rounded bg-ink/75 px-2 py-0.5 text-xs text-sand-light">Image provisoire</span>}
                      <span className="sr-only"> (ouvrir l'image en grand)</span>
                    </a>
                    {(m.caption || m.is_placeholder) && (
                      <figcaption className="mt-2 text-sm text-ink-soft">{m.caption ?? m.alt}</figcaption>
                    )}
                  </figure>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
