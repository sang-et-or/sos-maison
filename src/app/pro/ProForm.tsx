"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export interface ProFormValues {
  companyName: string; siret: string; categories: string[]; city: string; postalCode: string;
  departments: string; phone: string; email: string; website: string; description: string;
}

const EMPTY: ProFormValues = { companyName: "", siret: "", categories: [], city: "", postalCode: "", departments: "", phone: "", email: "", website: "", description: "" };

export function ProForm({ mode, categories, initial }: {
  mode: "create" | "edit";
  categories: { slug: string; name: string }[];
  initial: Partial<ProFormValues>;
}) {
  const router = useRouter();
  const [v, setV] = useState<ProFormValues>({ ...EMPTY, ...initial });
  const [certify, setCertify] = useState(mode === "edit");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const set = (k: keyof ProFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const toggleCat = (slug: string) =>
    setV({ ...v, categories: v.categories.includes(slug) ? v.categories.filter((c) => c !== slug) : [...v.categories, slug] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setOk(false);
    const r = await fetch("/api/pro", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, certify }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setErr(d.error ?? "Enregistrement impossible.");
    }
    setOk(true);
    router.refresh();
  }

  const field = (k: keyof ProFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={`pf-${k}`} className="block font-semibold">{label}</label>
      <input id={`pf-${k}`} value={v[k] as string} onChange={set(k)} className="input" {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className={mode === "create" ? "card space-y-4" : "space-y-4"}>
      {mode === "create" && <h2 className="section-title">Créer ma fiche artisan</h2>}
      {field("companyName", "Nom de l'entreprise", { required: true, maxLength: 120, autoComplete: "organization" })}
      {field("siret", "SIRET (14 chiffres)", { required: true, inputMode: "numeric", maxLength: 17, placeholder: "123 456 789 00012" })}
      <fieldset className="space-y-2">
        <legend className="font-semibold">Vos métiers</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const on = v.categories.includes(c.slug);
            return (
              <button key={c.slug} type="button" aria-pressed={on} onClick={() => toggleCat(c.slug)}
                      className={`rounded-full border-2 px-3.5 py-1.5 font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                {c.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3">
        {field("postalCode", "Code postal", { required: true, inputMode: "numeric", pattern: "[0-9]{5}", maxLength: 5 })}
        {field("city", "Ville", { required: true, maxLength: 80, autoComplete: "address-level2" })}
      </div>
      {field("departments", "Départements où vous intervenez", { placeholder: "ex. 69, 01, 38" })}
      {field("phone", "Téléphone professionnel", { required: true, type: "tel", autoComplete: "tel" })}
      {field("email", "E-mail où recevoir les demandes", { required: true, type: "email", autoComplete: "email" })}
      {field("website", "Site internet (facultatif)", { type: "url", placeholder: "https://" })}
      <div className="space-y-1.5">
        <label htmlFor="pf-description" className="block font-semibold">Présentation (facultatif)</label>
        <textarea id="pf-description" value={v.description} onChange={set("description")} maxLength={600} rows={3} className="input"
                  placeholder="Spécialités, délais d'intervention, garanties…" />
      </div>
      {mode === "create" && (
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={certify} onChange={(e) => setCertify(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-tangerine" />
          <span>Je certifie être habilité à représenter cette entreprise et j&apos;accepte les <Link href="/cgu" className="underline">conditions d&apos;utilisation</Link>.</span>
        </label>
      )}
      {err && <p role="alert" className="text-danger-700">{err}</p>}
      {ok && mode === "edit" && <p role="status" className="text-mint-700">Fiche enregistrée.</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Envoi…" : mode === "create" ? "Envoyer ma fiche" : "Enregistrer"}</button>
      {mode === "edit" && <p className="text-[0.9rem] text-muted">Changer le nom ou le SIRET renvoie la fiche en vérification.</p>}
    </form>
  );
}
