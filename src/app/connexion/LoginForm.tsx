"use client";
import { useState } from "react";
import Link from "next/link";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [accept, setAccept] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accept) return setError("Merci d'accepter les conditions d'utilisation.");
    setState("sending");
    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, acceptTerms: true, next }),
    }).catch(() => null);
    if (!res || !res.ok) {
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "Envoi impossible. Vérifiez votre connexion.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="card space-y-2">
        <p className="text-lg font-semibold text-brand-900">Regardez vos e-mails&nbsp;📬</p>
        <p className="text-slate-600">
          Nous avons envoyé un lien de connexion à <strong>{email}</strong>. Il est valable 15 minutes.
          Pensez à vérifier les courriers indésirables.
        </p>
        <button className="btn-soft mt-2 w-full" onClick={() => setState("idle")}>Changer d&apos;adresse</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="block font-semibold text-brand-900">Votre adresse e-mail</label>
        <input id="email" type="email" inputMode="email" autoComplete="email" required value={email}
               onChange={(e) => setEmail(e.target.value)} className="input" placeholder="prenom.nom@exemple.fr" />
      </div>
      <label className="flex items-start gap-3 text-[0.98rem] text-slate-700">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
               className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-brand-500" />
        <span>
          J&apos;accepte les <Link href="/cgu" className="underline">conditions d&apos;utilisation</Link> et la{" "}
          <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
        </span>
      </label>
      {error && <p role="alert" className="text-danger-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
    </form>
  );
}
