"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NEXT: Record<string, { s: string; t: string; c: string }[]> = {
  sent: [{ s: "accepted", t: "J'accepte", c: "btn-mint" }, { s: "declined", t: "Je refuse", c: "btn-soft" }],
  seen: [{ s: "accepted", t: "J'accepte", c: "btn-mint" }, { s: "declined", t: "Je refuse", c: "btn-soft" }],
  accepted: [{ s: "done", t: "Intervention terminée", c: "btn-ink" }],
  declined: [],
  done: [],
};

export function RequestActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const actions = NEXT[status] ?? [];
  if (!actions.length) return null;
  async function set(s: string) {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/pro/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }) });
    setBusy(false);
    if (!r.ok) return setErr("Impossible de mettre à jour. Réessayez.");
    router.refresh();
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((a) => (
        <button key={a.s} disabled={busy} onClick={() => set(a.s)} className={`${a.c} min-h-[44px] ${actions.length === 1 ? "col-span-2" : ""}`}>{a.t}</button>
      ))}
      {err && <p role="alert" className="col-span-2 text-danger-700">{err}</p>}
    </div>
  );
}
