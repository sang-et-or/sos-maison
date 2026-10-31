"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

async function call(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Erreur");
  return d;
}

export function ProReview({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(status: "verified" | "suspended") {
    setBusy(true);
    setErr("");
    try {
      await call(`/api/admin/pros/${id}`, "PATCH", { status, note });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="input" placeholder="Message à l'artisan (facultatif)" aria-label="Message à l'artisan" />
      <div className="grid grid-cols-2 gap-2">
        <button disabled={busy} onClick={() => go("verified")} className="btn-mint min-h-[44px]">Valider</button>
        <button disabled={busy} onClick={() => go("suspended")} className="btn-soft min-h-[44px]">Refuser</button>
      </div>
      {err && <p role="alert" className="text-danger-700">{err}</p>}
    </div>
  );
}

export function GrantCredits() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(50);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const d = await call("/api/admin/credits", "POST", { email, amount, reason });
      setMsg(`Fait. Nouveau solde : ${d.balance} crédits.`);
      setEmail("");
      setReason("");
    } catch (err) {
      setMsg((err as Error).message);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-2.5 rounded-3xl bg-white p-4">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="E-mail du compte" aria-label="E-mail du compte" />
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
        <input type="number" min={1} max={5000} required value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="input" aria-label="Nombre de crédits" />
        <input required minLength={3} maxLength={120} value={reason} onChange={(e) => setReason(e.target.value)} className="input" placeholder="Motif (ex. geste commercial)" aria-label="Motif" />
      </div>
      <button className="btn-ink">Ajouter les crédits</button>
      {msg && <p role="status">{msg}</p>}
    </form>
  );
}

export function SettingEditor({ k, description, value }: { k: string; description: string; value: string }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [msg, setMsg] = useState("");
  async function save() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(v);
    } catch {
      return setMsg("Format JSON invalide.");
    }
    try {
      await call("/api/admin/settings", "PATCH", { key: k, value: parsed });
      setMsg("Enregistré.");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <div className="space-y-2 rounded-3xl bg-white p-4">
      <div><b className="font-mono text-[0.9rem]">{k}</b><p className="text-[0.92rem] text-muted">{description}</p></div>
      <textarea value={v} onChange={(e) => { setV(e.target.value); setMsg(""); }} rows={v.length > 60 ? 3 : 1} className="input font-mono text-[0.9rem]" aria-label={k} spellCheck={false} />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={v === value} className="btn-soft min-h-[40px]">Enregistrer</button>
        {msg && <span role="status" className="text-[0.92rem]">{msg}</span>}
      </div>
    </div>
  );
}
