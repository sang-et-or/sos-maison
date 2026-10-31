import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ProForm, type ProFormValues } from "./ProForm";
import { RequestActions } from "./RequestActions";
import { REQUEST_LABEL } from "@/lib/pros";

export const dynamic = "force-dynamic";
export const metadata = { title: "Espace artisan — SOS Maison" };

const STATUS = {
  pending: { t: "En cours de vérification", d: "Nous vérifions votre SIRET sous 48 h ouvrées. Votre fiche apparaîtra ensuite dans l'annuaire.", c: "bg-sun-50 text-sun-700" },
  verified: { t: "Fiche visible", d: "Les particuliers de votre zone peuvent vous trouver et vous écrire.", c: "bg-mint-50 text-mint-700" },
  suspended: { t: "Fiche suspendue", d: "Votre fiche n'apparaît plus dans l'annuaire. Contactez-nous pour en savoir plus.", c: "bg-danger-50 text-danger-700" },
} as const;

interface ProRow {
  id: string; company_name: string; siret: string | null; description: string | null; phone: string | null;
  email: string | null; website: string | null; city: string; postal_code: string; service_departments: string[];
  status: keyof typeof STATUS; review_note: string | null; cats: string[];
}

export default async function ProPage() {
  const user = await currentUser();
  if (!user) redirect("/connexion?next=/pro");

  const categories = await sql<{ slug: string; name: string }[]>`select slug, name from pro_categories where active order by sort_order`;
  const [pro] = await sql<ProRow[]>`
    select p.id, p.company_name, p.siret, p.description, p.phone, p.email, p.website, p.city, p.postal_code,
           p.service_departments, p.status, p.review_note,
           coalesce(array_agg(l.category_slug) filter (where l.category_slug is not null), '{}') as cats
    from pros p left join pro_category_links l on l.pro_id = p.id
    where p.user_id = ${user.id}
    group by p.id`;

  if (!pro) {
    return (
      <div className="space-y-5 pt-3">
        <div className="space-y-2 rounded-[1.8rem] bg-ink p-5 text-white">
          <span className="badge bg-sun text-ink">Gratuit, sans commission</span>
          <h1 className="font-display text-[1.7rem] font-extrabold leading-tight">Recevez des clients près de chez vous</h1>
          <ul className="space-y-1 text-white/85">
            <li>✓ Les particuliers vous contactent directement</li>
            <li>✓ Le diagnostic de Toit-Toit vous arrive avec la demande (si le client l&apos;accepte)</li>
            <li>✓ Aucune commission sur vos interventions</li>
          </ul>
        </div>
        <ProForm mode="create" categories={categories} initial={{ email: user.email, postalCode: user.postal_code ?? "" }} />
      </div>
    );
  }

  const requests = await sql<{
    id: string; contact_name: string; contact_phone: string | null; contact_email: string | null; postal_code: string;
    message: string; shared_summary: string | null; status: keyof typeof REQUEST_LABEL; created_at: Date;
  }[]>`
    select id, contact_name, contact_phone, contact_email, postal_code, message, shared_summary, status, created_at
    from service_requests where pro_id = ${pro.id} order by created_at desc limit 50`;
  // Les nouvelles demandes passent en « vue » dès que l'artisan ouvre son espace.
  await sql`update service_requests set status = 'seen' where pro_id = ${pro.id} and status = 'sent'`;
  const st = STATUS[pro.status];
  const fresh = requests.filter((r) => r.status === "sent").length;
  const initial: ProFormValues = {
    companyName: pro.company_name, siret: pro.siret ?? "", categories: pro.cats, city: pro.city, postalCode: pro.postal_code,
    departments: pro.service_departments.join(", "), phone: pro.phone ?? "", email: pro.email ?? "",
    website: pro.website ?? "", description: pro.description ?? "",
  };

  return (
    <div className="space-y-5 pt-3">
      <div>
        <small className="font-bold text-muted">Espace artisan</small>
        <h1 className="font-display text-[1.7rem] font-extrabold leading-tight tracking-tight">{pro.company_name}</h1>
      </div>
      <section className={`space-y-1 rounded-3xl px-4 py-3 ${st.c}`}>
        <b className="font-display">{st.t}</b>
        <p className="text-ink">{st.d}</p>
        {pro.review_note && <p className="text-ink"><b>Message de l&apos;équipe&nbsp;: </b>{pro.review_note}</p>}
      </section>

      <section className="grid grid-cols-3 gap-2.5">
        <Kpi v={fresh} l="nouvelles" c="text-tangerine" />
        <Kpi v={requests.filter((r) => r.status === "accepted").length} l="acceptées" c="text-sky" />
        <Kpi v={requests.filter((r) => r.status === "done").length} l="terminées" c="text-mint" />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">Demandes reçues</h2>
        {requests.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-muted">
            Aucune demande pour l&apos;instant. {pro.status === "verified" ? "Elles arriveront ici et par e-mail." : "Elles arriveront dès la validation de votre fiche."}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {requests.map((r) => (
              <li key={r.id} className="space-y-2 rounded-3xl bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <b className="font-display">{r.contact_name}</b>
                    <small className="block text-muted">
                      {r.postal_code} · {new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(r.created_at)}
                    </small>
                  </div>
                  <span className="badge bg-paper">{REQUEST_LABEL[r.status]}</span>
                </div>
                <p className="whitespace-pre-wrap">{r.message}</p>
                {r.shared_summary && (
                  <p className="whitespace-pre-wrap rounded-2xl bg-sky-50 px-3 py-2 text-[0.95rem]"><b>Diagnostic Toit-Toit&nbsp;:</b>{"\n"}{r.shared_summary}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {r.contact_phone && <a href={`tel:${r.contact_phone.replace(/[^0-9+]/g, "")}`} className="badge bg-mint text-white">📞 {r.contact_phone}</a>}
                  {r.contact_email && !r.contact_email.endsWith("@invalid") && <a href={`mailto:${r.contact_email}`} className="badge bg-sky text-white">✉️ {r.contact_email}</a>}
                </div>
                <RequestActions id={r.id} status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-3xl bg-white p-4">
        <summary className="cursor-pointer font-display font-extrabold">Modifier ma fiche</summary>
        <div className="mt-3"><ProForm mode="edit" categories={categories} initial={initial} /></div>
      </details>
      <p className="text-center text-muted"><Link href="/artisans" className="underline">Voir l&apos;annuaire</Link></p>
    </div>
  );
}

function Kpi({ v, l, c }: { v: number; l: string; c: string }) {
  return (
    <div className="rounded-3xl bg-white px-2 py-3 text-center">
      <b className={`block font-display text-[1.5rem] font-extrabold tabular-nums ${c}`}>{v}</b>
      <small className="text-muted">{l}</small>
    </div>
  );
}
