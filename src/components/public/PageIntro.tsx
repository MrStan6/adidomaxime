import { paragraphs } from "@/lib/format";

/** En-tête de page : titre et texte d'introduction éditable. */
export function PageIntro({ title, body, children }: { title: string; body?: string; children?: React.ReactNode }) {
  return (
    <section className="border-b border-line bg-sand-light">
      <div className="wrap py-12 lg:py-16">
        <h1 className="text-4xl text-earth sm:text-5xl">{title}</h1>
        {body && (
          <div className="measure mt-5 space-y-4 text-lg text-ink-soft">
            {paragraphs(body).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
