"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNavLinks({ groups }: { groups: { name: string; items: { href: string; label: string; count?: number }[] }[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <>
      {groups.map((g) => (
        <div key={g.name} className="mb-5">
          <p className="mb-1.5 px-3 text-xs font-semibold text-sand/60">{g.name}</p>
          <ul>
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={isActive(i.href) ? "page" : undefined}
                  className={`flex min-h-10 items-center justify-between rounded-md px-3 py-2 text-[0.95rem] ${isActive(i.href) ? "bg-white/10 text-white" : "text-sand-light/85 hover:bg-white/5 hover:text-white"}`}
                >
                  {i.label}
                  {i.count ? <span className="rounded-full bg-gold px-2 text-xs font-semibold text-ink">{i.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
