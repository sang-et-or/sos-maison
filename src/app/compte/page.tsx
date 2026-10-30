import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AccountActions } from "./AccountActions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "En cours", cls: "bg-brand-50 text-brand-700" },
  resolved: { label: "Résolu", cls: "bg-emerald-50 text-emerald-700" },
  needs_pro: { label: "Professionnel", cls: "bg-warm-50 text-amber-800" },
  abandoned: { label: "Abandonné", cls: "bg-slate-100 text-slate-600" },
};

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/compte");

  const [[{ premium }], repairs] = await Promise.all([
    sql<{ premium: boolean }[]>`select is_premium(${user.id}) as premium`,
    sql<{ id: string; title: string; status: string; updated_at: Date }[]>`
      select id, title, status, updated_at from repairs where user_id = ${user.id} order by updated_at desc limit 50`,
  ]);

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Mon compte</h1>
        <p className="text-slate-600">{user.email}</p>
      </div>

      <section className="card flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{premium ? "Abonnement" : "Crédits restants"}</p>
          <p className="text-3xl font-extrabold text-brand-900">{premium ? "Premium" : user.credit_balance}</p>
        </div>
        <Link href="/depannage/nouveau" className="btn-primary">Nouveau dépannage</Link>
      </section>

      {!premium && (
        <section id="premium" className="card space-y-2 border-l-4 border-brand-500">
          <h2 className="text-lg font-bold text-brand-900">SOS Maison Premium</h2>
          <p className="text-slate-600">
            Dépannages sans compteur de crédits, photos, recherches, voix et vidéo inclus dans le cadre d&apos;un usage raisonnable.
          </p>
          <p className="font-semibold text-brand-900">2,99&nbsp;€ par mois ou 29,90&nbsp;€ par an</p>
          <button className="btn-soft w-full" disabled>Abonnement disponible très bientôt</button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-brand-900">Mes dépannages</h2>
        {repairs.length === 0 ? (
          <p className="card text-slate-600">Aucun dépannage pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {repairs.map((r) => (
              <li key={r.id}>
                <Link href={`/depannage/${r.id}`} className="card flex items-center justify-between gap-3 py-4 hover:ring-brand-500">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-brand-900">{r.title}</span>
                    <span className="text-sm text-slate-500">
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(r.updated_at)}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${STATUS[r.status]?.cls ?? ""}`}>
                    {STATUS[r.status]?.label ?? r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AccountActions />
    </div>
  );
}
