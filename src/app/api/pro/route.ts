import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { ProInput, parseDepartments } from "@/lib/pros";

async function validCategories(slugs: string[]) {
  const rows = await sql<{ slug: string }[]>`select slug from pro_categories where active and slug in ${sql(slugs)}`;
  if (rows.length !== new Set(slugs).size) throw new HttpError(400, "Métier inconnu.");
  return rows.map((r) => r.slug);
}

/** Inscription d'un artisan : la fiche reste invisible tant qu'elle n'est pas validée. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const p = ProInput.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Formulaire incomplet.");
    const b = p.data;
    const cats = await validCategories(b.categories);
    const id = await sql.begin(async (tx) => {
      const [exists] = await tx`select 1 from pros where user_id = ${user.id}`;
      if (exists) throw new HttpError(409, "Vous avez déjà une fiche artisan.");
      const [dup] = await tx`select 1 from pros where siret = ${b.siret} and status <> 'suspended'`;
      if (dup) throw new HttpError(409, "Ce SIRET est déjà inscrit. Contactez-nous si c'est une erreur.");
      const [row] = await tx<{ id: string }[]>`
        insert into pros (user_id, company_name, siret, description, phone, email, website, city, postal_code, service_departments, status)
        values (${user.id}, ${b.companyName}, ${b.siret}, ${b.description || null}, ${b.phone}, ${b.email.toLowerCase()},
                ${b.website || null}, ${b.city}, ${b.postalCode}, ${parseDepartments(b.departments)}, 'pending')
        returning id`;
      for (const c of cats) await tx`insert into pro_category_links values (${row.id}, ${c})`;
      await tx`update users set role = 'pro' where id = ${user.id} and role = 'user'`;
      await tx`insert into audit_logs (actor_id, action, target) values (${user.id}, 'pro_signup', ${row.id})`;
      return row.id;
    });
    return Response.json({ ok: true, id });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Mise à jour de la fiche. Changer le nom ou le SIRET renvoie la fiche en validation. */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const p = ProInput.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Formulaire incomplet.");
    const b = p.data;
    const cats = await validCategories(b.categories);
    await sql.begin(async (tx) => {
      const [cur] = await tx<{ id: string; company_name: string; siret: string | null; status: string }[]>`
        select id, company_name, siret, status from pros where user_id = ${user.id} for update`;
      if (!cur) throw new HttpError(404, "Aucune fiche artisan.");
      if (cur.status === "suspended") throw new HttpError(403, "Votre fiche est suspendue. Contactez-nous.");
      const review = cur.company_name !== b.companyName || cur.siret !== b.siret;
      await tx`
        update pros set company_name = ${b.companyName}, siret = ${b.siret}, description = ${b.description || null},
               phone = ${b.phone}, email = ${b.email.toLowerCase()}, website = ${b.website || null}, city = ${b.city},
               postal_code = ${b.postalCode}, service_departments = ${parseDepartments(b.departments)},
               status = ${review ? "pending" : cur.status}::pro_status, updated_at = now()
        where id = ${cur.id}`;
      await tx`delete from pro_category_links where pro_id = ${cur.id}`;
      for (const c of cats) await tx`insert into pro_category_links values (${cur.id}, ${c})`;
      await tx`insert into audit_logs (actor_id, action, target, details)
               values (${user.id}, 'pro_update', ${cur.id}, ${JSON.stringify({ review })}::text::jsonb)`;
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
