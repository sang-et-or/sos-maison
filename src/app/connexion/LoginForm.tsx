"use client";
import { useState } from "react";
import Link from "next/link";

type Mode = "login" | "signup" | "forgot";

/** Connexion par e-mail et mot de passe ; création de compte ; lien par e-mail seulement en cas d'oubli. */
export function LoginForm({ next, initialMode = "login" }: { next: string; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const go = (m: Mode) => { setMode(m); setError(null); setSent(false); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && !accept) return setError({ message: "Merci d'accepter les conditions d'utilisation." });
    setBusy(true);
    const url = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : "/api/auth/request";
    const body = mode === "forgot"
      ? { email, acceptTerms: true, next: "/compte?motdepasse=1", reset: true }
      : { email, password, ...(mode === "signup" ? { acceptTerms: true } : {}) };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const d = await res?.json().catch(() => ({}));
      return setError({ message: d?.error ?? "Connexion impossible. Vérifiez votre réseau.", code: d?.code });
    }
    if (mode === "forgot") return setSent(true);
    window.location.href = next;
  }

  if (sent) {
    return (
      <div className="card space-y-2">
        <p className="text-lg font-semibold text-ink">Regardez vos e-mails&nbsp;📬</p>
        <p className="text-muted">
          Si un compte existe pour <strong>{email}</strong>, vous allez recevoir un lien (valable 15 minutes) pour choisir un nouveau
          mot de passe. Pensez aux courriers indésirables.
        </p>
        <button className="btn-soft mt-2 w-full" onClick={() => go("login")}>Retour à la connexion</button>
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {mode !== "forgot" && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-paper p-1" role="tablist">
          {(["login", "signup"] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => go(m)}
                    className={`rounded-xl py-2.5 font-bold ${mode === m ? "bg-white text-ink shadow-soft" : "text-muted"}`}>
              {m === "login" ? "Se connecter" : "Créer un compte"}
            </button>
          ))}
        </div>
      )}
      {mode === "forgot" && (
        <div className="space-y-1">
          <h2 className="section-title">Mot de passe oublié</h2>
          <p className="text-muted">Indiquez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="block font-semibold text-ink">Adresse e-mail</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete={mode === "signup" ? "email" : "username"} required
                 value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="prenom.nom@exemple.fr" />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block font-semibold text-ink">Mot de passe</label>
              {mode === "login" && <button type="button" onClick={() => go("forgot")} className="text-[0.92rem] font-bold text-sky-700 underline">Mot de passe oublié&nbsp;?</button>}
            </div>
            <div className="relative">
              <input id="password" name="password" type={show ? "text" : "password"} required minLength={mode === "signup" ? 8 : 1}
                     autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password}
                     onChange={(e) => setPassword(e.target.value)} className="input pr-24" />
              <button type="button" onClick={() => setShow(!show)} aria-pressed={show}
                      className="absolute inset-y-0 right-2 my-auto h-9 rounded-xl px-3 text-[0.9rem] font-bold text-muted">
                {show ? "Masquer" : "Afficher"}
              </button>
            </div>
            {mode === "signup" && <p className="text-[0.9rem] text-muted">8 caractères minimum, avec au moins une lettre.</p>}
          </div>
        )}
        {mode === "signup" && (
          <label className="flex items-start gap-3 text-[0.98rem] text-ink">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
                   className="mt-1 h-5 w-5 shrink-0 rounded border-line accent-tangerine" />
            <span>
              J&apos;accepte les <Link href="/cgu" className="underline">conditions d&apos;utilisation</Link> et la{" "}
              <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
            </span>
          </label>
        )}
        {error && (
          <div role="alert" className="space-y-1 text-danger-700">
            <p>{error.message}</p>
            {(error.code === "no_password" || error.code === "exists") && (
              <button type="button" onClick={() => go("forgot")} className="font-bold underline">Choisir un mot de passe</button>
            )}
            {error.code === "wrong" && mode === "login" && (
              <button type="button" onClick={() => go("forgot")} className="font-bold underline">Mot de passe oublié&nbsp;?</button>
            )}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Un instant…" : mode === "login" ? "Me connecter" : mode === "signup" ? "Créer mon compte (100 crédits offerts)" : "Recevoir le lien"}
        </button>
        {mode === "forgot" && <button type="button" onClick={() => go("login")} className="btn-soft w-full">Retour</button>}
      </form>
    </div>
  );
}
