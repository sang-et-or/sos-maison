"use client";
import { useState } from "react";

/** Choisir ou changer son mot de passe depuis « Mon espace ». */
export function PasswordForm({ hasPassword, open: initiallyOpen, email }: { hasPassword: boolean; open: boolean; email: string }) {
  const [open, setOpen] = useState(initiallyOpen || !hasPassword);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const needCurrent = hasPassword && !initiallyOpen;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current, password }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, t: d.error ?? "Enregistrement impossible." });
    setMsg({ ok: true, t: "Mot de passe enregistré. La prochaine fois, connectez-vous avec votre e-mail et ce mot de passe." });
    setPassword("");
    setCurrent("");
  }

  return (
    <section id="mot-de-passe" className={`space-y-3 rounded-3xl p-4 ${hasPassword ? "bg-white" : "bg-sun-50 ring-2 ring-sun"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <b className="block font-display">Mot de passe</b>
          <small className="text-muted">{hasPassword ? "Votre compte est protégé par un mot de passe." : "Choisissez-en un pour vous connecter sans e-mail."}</small>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn-soft min-h-[40px] px-4">Changer</button>}
      </div>
      {open && (
        <form onSubmit={submit} className="space-y-3">
          <input type="email" name="email" autoComplete="username" hidden readOnly value={email} />
          {needCurrent && (
            <input type={show ? "text" : "password"} autoComplete="current-password" required value={current}
                   onChange={(e) => setCurrent(e.target.value)} className="input" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" />
          )}
          <input type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password}
                 onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Nouveau mot de passe (8 caractères minimum)" aria-label="Nouveau mot de passe" />
          <label className="flex items-center gap-2 text-[0.95rem]"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-tangerine" /> Afficher</label>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer mon mot de passe"}</button>
          {msg && <p role="status" className={msg.ok ? "text-mint-700" : "text-danger-700"}>{msg.t}</p>}
        </form>
      )}
    </section>
  );
}
