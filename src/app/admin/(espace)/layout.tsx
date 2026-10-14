import Link from "next/link";
import type { Metadata } from "next";
import { AdminNavLinks } from "@/components/admin/AdminNavLinks";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { requireUser } from "@/server/auth/current-user";
import { hasPermission } from "@/server/auth/permissions";
import { queryOne } from "@/server/db";
import { env } from "@/server/env";
import { ROLE_LABEL } from "@/lib/labels";
import { logout } from "../actions";

export const metadata: Metadata = { title: { default: "Administration", template: "%s | Administration" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = await queryOne<{ quotes: string; messages: string }>(
    `SELECT (SELECT count(*) FROM quote_requests WHERE status = 'new')::text AS quotes,
            (SELECT count(*) FROM contact_messages WHERE status = 'new')::text AS messages`,
  );
  const badge: Record<string, number> = { "/admin/demandes": Number(counts?.quotes ?? 0), "/admin/messages": Number(counts?.messages ?? 0) };
  const visible = ADMIN_NAV.filter((n) => !n.permission || hasPermission(user.role, n.permission));
  const groups = [...new Set(visible.map((n) => n.group))].map((name) => ({
    name,
    items: visible.filter((n) => n.group === name).map((n) => ({ href: n.href, label: n.label, count: badge[n.href] })),
  }));
  const demo = env().APP_MODE === "demo";

  const sidebar = (
    <>
      <AdminNavLinks groups={groups} />
      <div className="mt-6 border-t border-white/10 pt-4 text-sm">
        <p className="px-3 font-semibold text-white">{user.full_name}</p>
        <p className="px-3 text-sand/70">{ROLE_LABEL[user.role] ?? user.role}</p>
        <div className="mt-3 flex flex-col gap-1">
          <Link href="/admin/compte" className="rounded-md px-3 py-2 text-sand-light/85 hover:bg-white/5">Mon compte</Link>
          <Link href="/" className="rounded-md px-3 py-2 text-sand-light/85 hover:bg-white/5" target="_blank">Voir le site</Link>
          <form action={logout}><button className="w-full rounded-md px-3 py-2 text-left text-sand-light/85 hover:bg-white/5">Se déconnecter</button></form>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f6f3ee] lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="on-dark hidden bg-ink px-3 py-6 lg:block">
        <Link href="/admin" className="mb-8 block px-3 font-display text-xl text-paper">Administration</Link>
        <nav aria-label="Administration">{sidebar}</nav>
      </aside>
      <details className="on-dark bg-ink text-paper lg:hidden">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between px-5 font-display text-lg">Administration <span className="font-sans text-sm text-sand">Menu</span></summary>
        <nav aria-label="Administration" className="px-3 pb-5">{sidebar}</nav>
      </details>
      <div className="min-w-0">
        {demo && <p className="bg-[#f8efdc] px-5 py-2 text-sm text-warn">Mode démonstration : les paiements de démonstration ne sont jamais comptabilisés comme réels.</p>}
        <main className="mx-auto max-w-6xl px-5 py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
