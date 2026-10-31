import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql, getSetting } from "@/lib/db";
import { AccountActions } from "./AccountActions";
import { stripeConfigured } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "En cours", cls: "bg-sky-50 text-sky-700" },
  resolved: { label: "Résolu", cls: "bg-mint-50 text-mint-700" },
  needs_pro: { label: "Pro conseillé", cls: "bg-sun-50 text-sun-700" },
  abandoned: { label: "Abandonné", cls: "bg-paper text-muted" },
};

const ICON: Record<string, { bg: string; el: React.ReactNode }> = {
  plombier: { bg: "bg-sky-50", el: <path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#3d7bff" /> },
  chauffagiste: { bg: "bg-tangerine-50", el: <><rect x="4" y="6" width="16" height="13" rx="2" fill="#ff6b2c" /><path d="M8 8v9M12 8v9M16 8v9" stroke="#fff" strokeWidth="1.6" /></> },
  electromenager: { bg: "bg-mint-50", el: <><rect x="6" y="3" width="12" height="18" rx="2" fill="#22b8a0" /><circle cx="12" cy="13" r="3.5" fill="#fff" /></> },
  electricien: { bg: "bg-sun-50", el: <path d="M13 2 5 14h6l-1 8 8-12h-6z" fill="#e0a100" /> },
  default: { bg: "bg-lilac-50", el: <><path d="M3 11.5 12 4l9 7.5" stroke="#8b6cff" strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M6 10v10h12V10" fill="#8b6cff" /></> },
};

const PAYMENT_MSG: Record<string, { t: string; c: string }> = {
  ok: { t: "Merci ! Votre paiement est validé. Il peut s'afficher ici après quelques secondes.", c: "bg-mint-50 text-mint-700" },
  annule: { t: "Paiement annulé : rien n'a été débité.", c: "bg-paper text-ink" },
  deja: { t: "Vous êtes déjà abonné à Premium.", c: "bg-sky-50 text-sky-700" },
  indisponible: { t: "Le paiement en ligne n'est pas encore ouvert.", c: "bg-sun-50 text-sun-700" },
  erreur: { t: "Le paiement n'a pas pu démarrer. Réessayez dans un instant.", c: "bg-danger-50 text-danger-700" },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const { paiement } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/compte");

  const [[{ premium }], [stats], repairs, welcome, price, pack, [sub], [pro]] = await Promise.all([
    sql<{ premium: boolean }[]>`select is_premium(${user.id}) as premium`,
    sql<{ repairs: number; resolved: number; saved_eur: number }[]>`select * from user_stats(${user.id})`,
    sql<{ id: string; title: string; status: string; pro_category: string | null; updated_at: Date }[]>`
      select id, title, status, pro_category, updated_at from repairs where user_id = ${user.id} order by updated_at desc limit 50`,
    getSetting<number>("welcome_credits", 100),
    getSetting("premium_price_cents", { monthly: 299, yearly: 2990 }),
    getSetting("credit_pack", { credits: 100, price_cents: 199 }),
    sql<{ plan: string; status: string; current_period_end: Date | null; cancel_at_period_end: boolean }[]>`
      select plan, status, current_period_end, cancel_at_period_end from subscriptions
      where user_id = ${user.id} order by updated_at desc limit 1`,
    sql<{ status: string }[]>`select status from pros where user_id = ${user.id}`,
  ]);
  const payOpen = stripeConfigured();
  const money = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "\u00a0€";
  const msg = paiement ? PAYMENT_MSG[paiement] : undefined;
  const dateFr = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);

  const name = user.display_name || user.email.split("@")[0];
  const max = Math.max(Number(welcome) || 100, user.credit_balance);
  const ratio = premium ? 1 : Math.min(1, user.credit_balance / max);
  const C = 2 * Math.PI * 46;

  return (
    <div className="space-y-5 pt-3">
      <section className="grid grid-cols-[1fr_7rem] items-center gap-3 rounded-[1.8rem] bg-ink p-5 text-white">
        <div className="min-w-0">
          <small className="text-white/70">Bonjour</small>
          <p className="truncate font-display text-[1.4rem] font-extrabold capitalize">{name}</p>
          <small className="block truncate text-white/70">{user.email}</small>
        </div>
        <svg viewBox="0 0 112 112" className="h-28 w-28" role="img" aria-label={premium ? "Abonnement Premium" : `${user.credit_balance} crédits restants`}>
          <circle cx="56" cy="56" r="46" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="12" />
          <circle cx="56" cy="56" r="46" fill="none" stroke="#ffc83d" strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${C * ratio} ${C}`} transform="rotate(-90 56 56)" />
          <text x="56" y={premium ? 61 : 58} textAnchor="middle" fill="#fff" fontWeight="800" fontSize={premium ? 18 : 28} fontFamily="var(--font-display)">
            {premium ? "Premium" : user.credit_balance}
          </text>
          {!premium && <text x="56" y="76" textAnchor="middle" fill="#c9cde6" fontSize="11">crédits</text>}
        </svg>
      </section>

      <section className="grid grid-cols-3 gap-2.5" aria-label="Mes statistiques">
        <Stat value={String(stats.resolved)} label="problèmes résolus" color="text-mint" />
        <Stat value={String(stats.repairs)} label="dépannages" color="text-tangerine" />
        <Stat value={stats.saved_eur ? `≈${stats.saved_eur} €` : "—"} label="économisés (estimation)" color="text-sky" />
      </section>

      {msg && <p role="status" className={`rounded-3xl px-4 py-3 font-bold ${msg.c}`}>{msg.t}</p>}

      {premium ? (
        <section id="premium" className="grid gap-2 rounded-[1.8rem] bg-sun-50 p-5">
          <b className="font-display text-[1.2rem] font-extrabold">{`Premium ${sub?.plan === "yearly" ? "annuel" : "mensuel"}`}</b>
          {sub?.current_period_end && (
            <p>{sub.cancel_at_period_end ? `Résilié : reste actif jusqu'au ${dateFr(sub.current_period_end)}.` : `Prochain renouvellement le ${dateFr(sub.current_period_end)}.`}</p>
          )}
          <form action="/api/billing/portal" method="post">
            <button className="btn-soft w-full">Gérer mon abonnement et mes factures</button>
          </form>
        </section>
      ) : (
        <section id="premium" className="relative grid gap-2.5 overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-sun to-[#ffb03d] p-5">
          <span aria-hidden className="absolute -bottom-10 -right-8 h-32 w-32 rounded-full bg-white/35" />
          <b className="relative font-display text-[1.35rem] font-extrabold">Premium</b>
          <p className="relative">Dépannages sans compter, photos, recherches, voix et vidéo inclus (usage raisonnable).</p>
          <p className="relative font-display text-[2rem] font-extrabold leading-none">{money(price.monthly)}<small className="font-sans text-base font-bold"> /mois</small></p>
          <p className="relative text-[0.95rem]">ou {money(price.yearly)} par an, soit {Math.max(0, Math.round(12 - price.yearly / price.monthly))} mois offerts · sans engagement</p>
          {payOpen ? (
            <div className="relative grid gap-2">
              <form action="/api/billing/checkout" method="post"><input type="hidden" name="offre" value="monthly" />
                <button className="btn-ink w-full">Passer à Premium</button></form>
              <form action="/api/billing/checkout" method="post"><input type="hidden" name="offre" value="yearly" />
                <button className="btn w-full bg-white/70 text-ink">Choisir l&apos;année ({money(price.yearly)})</button></form>
            </div>
          ) : (
            <button className="btn-ink relative w-full" disabled>Bientôt disponible</button>
          )}
        </section>
      )}

      {!premium && payOpen && (
        <form action="/api/billing/checkout" method="post" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-3xl bg-white p-4">
          <input type="hidden" name="offre" value="pack" />
          <span><b className="block">Pack de {pack.credits} crédits</b><small className="text-muted">Sans abonnement, sans date limite</small></span>
          <button className="btn-soft min-h-[44px]">{money(pack.price_cents)}</button>
        </form>
      )}

      <nav className="grid gap-2" aria-label="Autres espaces">
        <Link href="/pro" className="flex items-center justify-between rounded-3xl bg-white px-4 py-3 font-bold">
          {pro ? "Mon espace artisan" : "Vous êtes artisan ? Créez votre fiche"} <span aria-hidden>›</span>
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className="flex items-center justify-between rounded-3xl bg-ink px-4 py-3 font-bold text-white">Administration <span aria-hidden>›</span></Link>
        )}
      </nav>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Mes dépannages</h2>
          <Link href="/depannage/nouveau" className="rounded-full bg-tangerine px-3.5 py-1.5 text-sm font-bold text-white">+ Nouveau</Link>
        </div>
        {repairs.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-muted">Aucun dépannage pour l&apos;instant. Toit-Toit vous attend&nbsp;!</p>
        ) : (
          <ul className="space-y-2.5">
            {repairs.map((r) => {
              const ic = ICON[r.pro_category ?? ""] ?? ICON.default;
              const st = STATUS[r.status] ?? STATUS.open;
              return (
                <li key={r.id}>
                  <Link href={`/depannage/${r.id}`} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-3xl bg-white px-3.5 py-3">
                    <span className={`grid h-11 w-11 place-items-center rounded-2xl ${ic.bg}`}>
                      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>{ic.el}</svg>
                    </span>
                    <span className="min-w-0">
                      <b className="block truncate">{r.title}</b>
                      <small className="text-muted">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(r.updated_at)}</small>
                    </span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AccountActions />
    </div>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="rounded-3xl bg-white px-2 py-3 text-center">
      <b className={`block font-display text-[1.45rem] font-extrabold tabular-nums ${color}`}>{value}</b>
      <small className="block text-[0.8rem] leading-tight text-muted">{label}</small>
    </div>
  );
}
