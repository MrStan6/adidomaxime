import Link from "next/link";
import { FieldError } from "./AdminForm";

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl text-earth">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-white p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 font-sans text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-ink-soft">{children}</div>}
    </div>
  );
}

/** Champ texte d'administration avec erreur liée à l'action. */
export function AField({
  name,
  label,
  hint,
  children,
  className = "",
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">{label}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
      <FieldError name={name} />
    </div>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="-mx-5 overflow-x-auto sm:mx-0">{children}</div>;
}

export function FilterLinks({ base, param, current, options, showAll = true }: { base: string; param: string; current?: string; options: { value: string; label: string }[]; showAll?: boolean }) {
  return (
    <nav aria-label="Filtres" className="mb-5 flex flex-wrap gap-2">
      {showAll && <Link href={base} className={`btn btn-sm ${!current ? "btn-primary" : "btn-secondary"}`} aria-current={!current ? "page" : undefined}>Tous</Link>}
      {options.map((o) => (
        <Link key={o.value} href={`${base}?${param}=${o.value}`} className={`btn btn-sm ${current === o.value ? "btn-primary" : "btn-secondary"}`} aria-current={current === o.value ? "page" : undefined}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mention signalant une information non confirmée. */
export function ToFill({ children = "À renseigner" }: { children?: React.ReactNode }) {
  return <span className="badge badge-warning">{children}</span>;
}
