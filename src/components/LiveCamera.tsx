"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Caméra en direct : l'utilisateur filme le problème et envoie l'image au bon moment.
 * Rien n'est enregistré ni envoyé tant qu'il n'appuie pas sur « Envoyer cette image ».
 */
export function LiveCamera({ onCapture, onClose, remaining }: {
  onCapture: (b: Blob) => Promise<unknown>;
  onClose: () => void;
  remaining: number;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La caméra n'est pas disponible sur ce navigateur. Utilisez le bouton photo.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as unknown as { torch?: boolean };
        setTorch(caps.torch ? false : null);
        setReady(true);
      } catch (e) {
        const name = (e as DOMException).name;
        setError(name === "NotAllowedError"
          ? "Autorisez la caméra dans les réglages du navigateur, puis réessayez."
          : "Impossible d'ouvrir la caméra. Utilisez le bouton photo.");
      }
    })();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [facing]);

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as unknown as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  }

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth || busy) return;
    setBusy(true);
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    if (blob) {
      await onCapture(blob);
      setSent((n) => n + 1);
    }
    setBusy(false);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Caméra en direct" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <b className="font-display">Montrez le problème</b>
        <button onClick={onClose} className="rounded-full bg-white/15 px-4 py-2 font-bold">Terminé</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay className="h-full w-full object-cover" />
        {!ready && !error && <p className="absolute inset-0 grid place-items-center text-white/80">Ouverture de la caméra…</p>}
        {error && <p role="alert" className="absolute inset-x-4 top-1/3 rounded-2xl bg-white p-4 text-center text-ink">{error}</p>}
        {sent > 0 && <p role="status" className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-mint px-4 py-1.5 font-bold">{sent} image{sent > 1 ? "s" : ""} prête{sent > 1 ? "s" : ""} à envoyer</p>}
      </div>
      <div className="grid grid-cols-3 items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <button onClick={() => setFacing(facing === "environment" ? "user" : "environment")} className="justify-self-start rounded-full bg-white/15 p-3" aria-label="Changer de caméra">
          <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><path d="M9 13a3 3 0 0 1 5-2.2M15 13a3 3 0 0 1-5 2.2" /></svg>
        </button>
        <button onClick={capture} disabled={!ready || busy || remaining <= 0} aria-label="Envoyer cette image"
                className="grid h-20 w-20 place-items-center justify-self-center rounded-full border-4 border-white bg-tangerine disabled:opacity-40">
          {busy ? <span className="h-7 w-7 animate-spin rounded-full border-4 border-white border-t-transparent" /> : <span className="h-14 w-14 rounded-full bg-white/90" />}
        </button>
        {torch !== null ? (
          <button onClick={toggleTorch} aria-pressed={torch} className={`justify-self-end rounded-full p-3 ${torch ? "bg-sun text-ink" : "bg-white/15"}`} aria-label="Lampe">
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M13 2 5 14h6l-1 8 8-12h-6z" /></svg>
          </button>
        ) : <span />}
      </div>
      <p className="pb-3 text-center text-[0.85rem] text-white/60">
        {remaining > 0 ? `Encore ${remaining} image${remaining > 1 ? "s" : ""} possible${remaining > 1 ? "s" : ""} pour ce message` : "4 images maximum par message : appuyez sur Terminé"}
      </p>
    </div>
  );
}
