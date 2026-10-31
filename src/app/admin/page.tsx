import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql, getSetting } from "@/lib/db";
import { monthlyRevenueCents, SETTING_SCHEMAS, type AdminStats } from "@/lib/admin";
import { ProReview, GrantCredits, SettingEditor } from "./AdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration — SOS Maison", robots: { index: false } };

const eur = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
const usd = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(n);

const KIND: Record<string, string> = {
  message: "Messages", photo: "Photos", search: "Recherches web", voice_minute: "Voix", video_minute: "Vidéo",
  classifier: "Contrôle de sécurité", places: "Google Maps",
};

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/admin");
  if (user.role !== "admin") {
    return <p className="mt-8 rounded-3xl bg-white p-5">Cette page est réservée à l&apos;administration.</p>;
  }

  const [[{ s }], price, pack, pending, settings, logs] = await Promise.all([
    sql<{ s: AdminStats }[]>`select admin_stats() as s`,
    getSetting("premium_price_cents", { monthly: 299, yearly: 2990 }),
    getSetting("credit_pack", { credits: 100, price_cents: 199 }),
    sql<{ id: string; company_name: string; siret: string | null; city: string; postal_code: string; phone: string | null;
          email: string | null; website: string | null; description: string | null; created_at: Date; cats: string[] }[]>`
      select p.id, p.company_name, p.siret, p.city, p.postal_code, p.phone, p.email, p.website, p.description, p.created_at,
             coalesce(array_agg(c.name) filter (where c.name is not null), '{}') as cats
      from pros p left join pro_category_links l on l.pro_id = p.id left join pro_categories c on c.slug = l.category_slug
      where p.status = 'pending' group by p.id order by p.created_at limit 50`,
    sql<{ key: string; value: unknown; description: string }[]>`select key, value, description from settings order by key`,
    sql<{ action: string; target: string | null; created_at: Date; email: string | null }[]>`
      select a.action, a.target, a.created_at, u.email from audit_logs a left join users u on u.id = a.actor_id
      order by a.id desc limit 30`,
  ]);

  const revenue = monthlyRevenueCents(s, price, pack.price_cents);
  const perActive = s.active_30d ? s.cost_usd_month / s.active_30d : 0;
  const resolvedRate = s.repairs_month ? Math.round((100 * s.resolved_month) / s.repairs_month) : 0;

  return (
    <div className="space-y-6 pt-3">
      <h1 className="font-display text-[1.8rem] font-extrabold tracking-tight">Administration</h1>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Indicateurs">
        <Kpi v={String(s.users)} l={`comptes (+${s.users_7d} en 7 j)`} />
        <Kpi v={String(s.active_30d)} l="actifs sur 30 jours" />
        <Kpi v={String(s.premium)} l={`Premium (${s.premium_yearly} annuels)`} />
        <Kpi v={String(s.repairs_month)} l={`dépannages ce mois (${resolvedRate} % résolus)`} />
        <Kpi v={String(s.emergencies_month)} l="urgences détectées ce mois" />
        <Kpi v={String(s.requests_month)} l="demandes aux artisans ce mois" />
      </section>

      <section className="space-y-2 rounded-[1.8rem] bg-ink p-5 text-white">
        <h2 className="font-display text-lg font-extrabold">Finances du mois (estimation)</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-white/70">Recettes TTC</dt><dd className="font-display text-2xl font-extrabold">{eur(revenue)}</dd></div>
          <div><dt className="text-white/70">Coût des services (IA, recherche)</dt><dd className="font-display text-2xl font-extrabold">{usd(Number(s.cost_usd_month))}</dd></div>
          <div><dt className="text-white/70">Coût moyen par actif</dt><dd className="font-bold">{usd(perActive)}</dd></div>
          <div><dt className="text-white/70">Crédits consommés</dt><dd className="font-bold">{s.credits_month} · {s.packs_month} packs vendus</dd></div>
        </dl>
        <ul className="flex flex-wrap gap-2 pt-1">
          {Object.entries(s.cost_by_kind).map(([k, v]) => <li key={k} className="badge bg-white/10">{KIND[k] ?? k} : {usd(Number(v))}</li>)}
        </ul>
        <p className="text-[0.85rem] text-white/60">Recettes calculées sur les abonnements actifs (annuel ramené au mois) et les packs, avant TVA et frais Stripe. Coûts en dollars, tels que facturés par les fournisseurs.</p>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Artisans à vérifier ({s.pros_pending})</h2>
        {pending.length === 0 ? <p className="rounded-3xl bg-white p-4 text-muted">Rien en attente. {s.pros_verified} artisans visibles.</p> : (
          <ul className="space-y-2.5">
            {pending.map((p) => (
              <li key={p.id} className="space-y-2 rounded-3xl bg-white p-4">
                <b className="font-display">{p.company_name}</b>
                <p className="text-[0.95rem] text-muted">{p.cats.join(", ")} · {p.postal_code} {p.city} · inscrit le {new Intl.DateTimeFormat("fr-FR").format(p.created_at)}</p>
                <p className="text-[0.95rem]">
                  SIRET {p.siret ?? "—"}{" "}
                  {p.siret && <a className="text-sky-700 underline" href={`https://annuaire-entreprises.data.gouv.fr/etablissement/${p.siret}`} target="_blank" rel="noopener noreferrer">vérifier sur l&apos;annuaire officiel</a>}
                </p>
                <p className="text-[0.95rem]">{p.phone} · {p.email} {p.website && <>· <a href={p.website} className="underline" target="_blank" rel="noopener noreferrer nofollow">site</a></>}</p>
                {p.description && <p className="text-[0.95rem]">{p.description}</p>}
                <ProReview id={p.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Offrir des crédits</h2>
        <GrantCredits />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Réglages</h2>
        <ul className="space-y-2.5">
          {settings.filter((r) => r.key in SETTING_SCHEMAS).map((r) => (
            <li key={r.key}><SettingEditor k={r.key} description={r.description} value={JSON.stringify(r.value)} /></li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Journal</h2>
        <ul className="divide-y divide-line rounded-3xl bg-white px-4 text-[0.92rem]">
          {logs.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span className="min-w-0 truncate"><b>{l.action}</b> {l.email ? `· ${l.email}` : ""}</span>
              <time className="shrink-0 text-muted">{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(l.created_at)}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-3xl bg-white p-3.5">
      <b className="block font-display text-[1.6rem] font-extrabold tabular-nums">{v}</b>
      <small className="text-muted">{l}</small>
    </div>
  );
}
