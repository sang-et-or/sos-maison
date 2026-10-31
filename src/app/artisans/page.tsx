import Link from "next/link";
import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { ProCard, type ProView } from "./ProCard";
import { GoogleResults } from "./GoogleResults";

export const dynamic = "force-dynamic";

const COLORS = ["#ffc83d", "#ddf6f1", "#ffe9df", "#e4edff", "#eee9ff"];

export default async function ProsPage({
  searchParams,
}: {
  searchParams: Promise<{ cp?: string; metier?: string; depannage?: string }>;
}) {
  const { cp: cpParam, metier = "", depannage } = await searchParams;
  const user = await currentUser().catch(() => null);
  const cp = cpParam ?? user?.postal_code ?? "";
  const categories = await sql<{ slug: string; name: string }[]>`
    select slug, name from pro_categories where active order by sort_order`;
  const validCp = /^[0-9]{5}$/.test(cp);
  const validCat = categories.some((c) => c.slug === metier) ? metier : null;

  const pros = validCp
    ? await sql<(ProView & { cats: string[] })[]>`
        select p.id, p.company_name, p.city, p.postal_code, p.description, p.phone, p.email, p.website, p.siret,
               coalesce(array_agg(c.name order by c.sort_order) filter (where c.name is not null), '{}') as cats
        from find_pros(${cp}, ${validCat}) p
        left join pro_category_links l on l.pro_id = p.id
        left join pro_categories c on c.slug = l.category_slug
        group by p.id, p.company_name, p.city, p.postal_code, p.description, p.phone, p.email, p.website, p.siret
        limit 30`
    : [];

  // Le dépannage d'origine n'est proposé au partage que s'il appartient bien à l'utilisateur.
  let repair: { id: string; title: string } | null = null;
  if (user && depannage && /^[0-9a-f-]{36}$/i.test(depannage)) {
    const [r] = await sql<{ id: string; title: string }[]>`
      select id, title from repairs where id = ${depannage} and user_id = ${user.id}`;
    repair = r ?? null;
  }

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(validCp ? { cp } : {}), ...(depannage ? { depannage } : {}), ...extra });
    return `/artisans?${p}`;
  };

  return (
    <div className="space-y-5 pt-3">
      <div>
        <h1 className="font-display text-[1.8rem] font-extrabold leading-tight tracking-tight">Un pro près de chez vous</h1>
        <p className="text-muted">Artisans vérifiés, contact direct, sans commission.</p>
      </div>

      <form method="get" className="grid gap-2.5 rounded-[1.6rem] bg-white p-3">
        {depannage && <input type="hidden" name="depannage" value={depannage} />}
        {validCat && <input type="hidden" name="metier" value={validCat} />}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <label htmlFor="cp" className="sr-only">Code postal</label>
          <input id="cp" name="cp" defaultValue={cp} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required
                 placeholder="Votre code postal" className="input" />
          <button className="btn-ink">Chercher</button>
        </div>
        <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" aria-label="Métiers">
          <Link href={qs({})} aria-current={!validCat ? "true" : undefined}
                className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[0.9rem] font-bold ${!validCat ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>Tous</Link>
          {categories.map((c) => (
            <Link key={c.slug} href={qs({ metier: c.slug })} aria-current={validCat === c.slug ? "true" : undefined}
                  className={`shrink-0 rounded-full border-2 px-3.5 py-1.5 text-[0.9rem] font-bold ${validCat === c.slug ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              {c.name}
            </Link>
          ))}
        </nav>
      </form>

      {validCp &&
        (pros.length === 0 ? (
          <div className="grid gap-1 rounded-[1.6rem] bg-white p-5">
            <b className="font-display text-[1.1rem]">Pas encore d&apos;artisan inscrit ici</b>
            <p className="text-muted">L&apos;annuaire s&apos;agrandit chaque semaine. En attendant, Toit-Toit peut vous aider à préparer votre demande.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pros.map((p, i) => (
              <li key={p.id}>
                <ProCard pro={p} color={COLORS[i % COLORS.length]} specialties={p.cats} loggedIn={Boolean(user)}
                         defaultEmail={user?.email ?? ""} postalCode={cp} repair={repair} />
              </li>
            ))}
          </ul>
        ))}

      {validCp && (
        <GoogleResults
          key={`${cp}-${validCat ?? "multiservices"}`}
          trade={validCat ?? "multiservices"}
          tradeName={categories.find((c) => c.slug === validCat)?.name ?? "Artisan"}
          place={cp}
          loggedIn={Boolean(user)}
        />
      )}

      <p className="text-center text-muted">
        Vous êtes artisan&nbsp;? <b className="text-ink">L&apos;inscription est gratuite.</b>
      </p>
    </div>
  );
}
