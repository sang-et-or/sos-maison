import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Pro {
  id: string;
  company_name: string;
  city: string;
  postal_code: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

/** Annuaire : recherche par code postal et métier. Formulaire de demande et espace artisan : jalon 2. */
export default async function ProsPage({ searchParams }: { searchParams: Promise<{ cp?: string; metier?: string }> }) {
  const { cp = "", metier = "" } = await searchParams;
  const categories = await sql<{ slug: string; name: string }[]>`
    select slug, name from pro_categories where active order by sort_order`;
  const validCp = /^[0-9]{5}$/.test(cp);
  const validCat = categories.some((c) => c.slug === metier) ? metier : null;
  const pros = validCp ? await sql<Pro[]>`select * from find_pros(${cp}, ${validCat}) limit 30` : [];

  return (
    <div className="space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold text-brand-900">Trouver un professionnel</h1>
        <p className="text-slate-600">Plombiers, électriciens, chauffagistes et autres artisans près de chez vous.</p>
      </div>

      <form className="card space-y-3" method="get">
        <div className="space-y-2">
          <label htmlFor="cp" className="block font-semibold text-brand-900">Code postal</label>
          <input id="cp" name="cp" defaultValue={cp} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required
                 className="input" placeholder="69003" />
        </div>
        <div className="space-y-2">
          <label htmlFor="metier" className="block font-semibold text-brand-900">Métier</label>
          <select id="metier" name="metier" defaultValue={validCat ?? ""} className="input">
            <option value="">Tous les métiers</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <button className="btn-primary w-full">Rechercher</button>
      </form>

      {validCp && (
        pros.length === 0 ? (
          <div className="card space-y-1">
            <p className="font-semibold text-brand-900">Aucun professionnel inscrit dans cette zone pour le moment.</p>
            <p className="text-slate-600">L&apos;annuaire s&apos;agrandit chaque semaine. Vous êtes artisan&nbsp;? L&apos;inscription sera bientôt ouverte et gratuite.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pros.map((p) => (
              <li key={p.id} className="card space-y-2">
                <p className="text-lg font-bold text-brand-900">{p.company_name}</p>
                <p className="text-slate-500">{p.city} ({p.postal_code})</p>
                {p.description && <p className="text-slate-700">{p.description}</p>}
                <div className="grid gap-2 pt-1">
                  {p.phone && <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="btn-primary w-full">Appeler · {p.phone}</a>}
                  {p.email && <a href={`mailto:${p.email}`} className="btn-soft w-full">Envoyer un e-mail</a>}
                  {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="btn-soft w-full">Site internet</a>}
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
