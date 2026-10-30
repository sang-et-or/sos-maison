"use client";
import { useState } from "react";
import Link from "next/link";

export interface ProView {
  id: string;
  company_name: string;
  city: string;
  postal_code: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  siret: string | null;
}

/** Fiche artisan + formulaire de demande d'intervention dépliable. */
export function ProCard(props: {
  pro: ProView;
  color: string;
  specialties: string[];
  loggedIn: boolean;
  defaultEmail: string;
  postalCode: string;
  repair: { id: string; title: string } | null;
}) {
  const { pro } = props;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: props.defaultEmail,
    message: props.repair ? `Bonjour, j'aurais besoin d'une intervention : ${props.repair.title}.` : "",
    consentShare: Boolean(props.repair),
  });
  const initials = pro.company_name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState("sending");
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proId: pro.id,
        repairId: props.repair?.id,
        name: form.name,
        phone: form.phone,
        email: form.email,
        postalCode: props.postalCode,
        message: form.message,
        consentShare: Boolean(props.repair) && form.consentShare,
      }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(data?.error ?? "Envoi impossible. Vérifiez votre connexion.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <article className="grid gap-3 rounded-[1.6rem] bg-white p-4">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-[1.1rem] font-display text-[1.2rem] font-extrabold" style={{ background: props.color }}>{initials}</span>
        <span className="min-w-0">
          <b className="block truncate font-display text-[1.12rem]">{pro.company_name}</b>
          <small className="text-muted">{pro.city} ({pro.postal_code})</small>
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {pro.siret && <li className="badge bg-mint-50 text-mint-700">✓ SIRET vérifié</li>}
        {props.specialties.map((s) => <li key={s} className="badge bg-sky-50 text-sky-700">{s}</li>)}
      </ul>
      {pro.description && <p className="text-[0.97rem]">{pro.description}</p>}

      {state === "sent" ? (
        <p role="status" className="rounded-2xl bg-mint-50 px-4 py-3 font-bold text-mint-700">
          Demande envoyée à {pro.company_name}. L&apos;artisan vous recontacte directement.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {pro.phone ? (
            <a href={`tel:${pro.phone.replace(/[^0-9+]/g, "")}`} className="btn-primary">Appeler</a>
          ) : (
            <span className="btn-soft opacity-60">Pas de téléphone</span>
          )}
          {props.loggedIn ? (
            <button type="button" className="btn-soft" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Fermer" : "Demander"}
            </button>
          ) : (
            <Link className="btn-soft" href={`/connexion?next=${encodeURIComponent(`/artisans?cp=${props.postalCode}`)}`}>Demander</Link>
          )}
        </div>
      )}
      {pro.phone && state !== "sent" && <p className="-mt-1 text-center text-sm text-muted">{pro.phone}</p>}

      {open && state !== "sent" && (
        <form onSubmit={submit} className="grid animate-pop gap-3 rounded-2xl bg-paper p-3">
          <Field id={`n-${pro.id}`} label="Votre nom">
            <input id={`n-${pro.id}`} required minLength={2} maxLength={80} autoComplete="name" className="input bg-white"
                   value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field id={`t-${pro.id}`} label="Téléphone">
              <input id={`t-${pro.id}`} type="tel" inputMode="tel" autoComplete="tel" className="input bg-white"
                     value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field id={`e-${pro.id}`} label="E-mail">
              <input id={`e-${pro.id}`} type="email" autoComplete="email" className="input bg-white"
                     value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field id={`m-${pro.id}`} label="Votre besoin">
            <textarea id={`m-${pro.id}`} required minLength={10} maxLength={2000} rows={3} className="input resize-none bg-white"
                      value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </Field>
          {props.repair && (
            <label className="flex items-start gap-3 text-[0.95rem]">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-tangerine" checked={form.consentShare}
                     onChange={(e) => setForm({ ...form, consentShare: e.target.checked })} />
              <span>Joindre le résumé de mon dépannage « {props.repair.title} » (diagnostic de Toit-Toit). Les photos ne sont pas transmises.</span>
            </label>
          )}
          {error && <p role="alert" className="text-danger-700">{error}</p>}
          <button className="btn-primary w-full" disabled={state === "sending" || (!form.phone && !form.email)}>
            {state === "sending" ? "Envoi…" : "Envoyer ma demande"}
          </button>
          <p className="text-center text-sm text-muted">Gratuit et sans engagement. Vos coordonnées ne sont transmises qu&apos;à cet artisan.</p>
        </form>
      )}
    </article>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-[0.92rem] font-bold">{label}</label>
      {children}
    </div>
  );
}
