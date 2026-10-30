"use client";
import { useState } from "react";

export function AccountActions() {
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function remove() {
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error ?? "Suppression impossible pour le moment.");
    }
    window.location.href = "/?compte=supprime";
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-brand-900">Mes données</h2>
      <a href="/api/account/export" className="btn-soft w-full">Télécharger mes données</a>
      <button onClick={logout} className="btn-soft w-full">Me déconnecter</button>
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn w-full text-danger-700 underline">Supprimer mon compte</button>
      ) : (
        <div className="card space-y-3 ring-red-200">
          <p className="text-slate-700">
            Tous vos dépannages, photos et équipements seront supprimés définitivement. Tapez <strong>SUPPRIMER</strong> pour confirmer.
          </p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" aria-label="Confirmation" autoCapitalize="characters" />
          {error && <p role="alert" className="text-danger-700">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setOpen(false)} className="btn-soft">Annuler</button>
            <button onClick={remove} disabled={confirm !== "SUPPRIMER"} className="btn-danger">Supprimer</button>
          </div>
        </div>
      )}
    </section>
  );
}
