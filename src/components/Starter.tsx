"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compressImage, dictationSupported, startDictation } from "./media";

export const DRAFT_KEY = "sm_draft";
export const DRAFT_PHOTO_KEY = "sm_draft_photo";

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Point d'entrée de la page d'accueil : on décrit son problème tout de suite. */
export function Starter({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  function go() {
    const target = "/depannage/nouveau";
    router.push(loggedIn ? target : `/connexion?next=${encodeURIComponent(target)}`);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) {
      areaRef.current?.focus();
      return;
    }
    sessionStorage.setItem(DRAFT_KEY, text.trim());
    go();
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const { blob } = await compressImage(f);
      sessionStorage.setItem(DRAFT_PHOTO_KEY, await blobToDataUrl(blob));
      if (text.trim()) sessionStorage.setItem(DRAFT_KEY, text.trim());
      go();
    } catch {
      setNote("Cette photo n'a pas pu être lue. Essayez d'en prendre une autre.");
    } finally {
      setBusy(false);
    }
  }

  function toggleDictation() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    if (!dictationSupported()) {
      setNote("La dictée n'est pas disponible sur ce navigateur : utilisez le micro de votre clavier.");
      areaRef.current?.focus();
      return;
    }
    const before = text ? text.trim() + " " : "";
    setListening(true);
    stopRef.current = startDictation({
      onText: (t) => setText(before + t),
      onEnd: () => setListening(false),
      onError: (m) => {
        setNote(m);
        setListening(false);
      },
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-3">
        <label htmlFor="probleme" className="block text-xl font-bold text-brand-900">
          Quel est votre problème&nbsp;?
        </label>
        <textarea
          id="probleme"
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder="Par exemple : ma chasse d'eau coule en permanence"
          className="input resize-none"
        />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          Obtenir de l&apos;aide
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>

      {note && (
        <p role="status" className="rounded-2xl bg-warm-50 px-4 py-3 text-[0.98rem] text-amber-900 ring-1 ring-warm-100">
          {note}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Option label="Écrire" hint="Décrivez le problème" onClick={() => areaRef.current?.focus()} icon="pen" />
        <Option label="Prendre une photo" hint="Montrez ce qui ne va pas" onClick={() => photoRef.current?.click()} icon="camera" disabled={busy} />
        <Option
          label={listening ? "J'écoute… (arrêter)" : "Parler"}
          hint="Dictez votre message"
          onClick={toggleDictation}
          icon="mic"
          active={listening}
        />
        <Option label="Montrer en vidéo" hint="Filmez, l'IA regarde" onClick={() => videoRef.current?.click()} icon="video" disabled={busy} />
      </div>
      <a href="/artisans" className="btn-soft w-full">
        <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>
        Trouver un professionnel
      </a>

      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
      {/* Première version de la vidéo : capture d'une image depuis la caméra. Le direct arrive au jalon 3. */}
      <input ref={videoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
    </div>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  pen: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />,
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3z" />
    </>
  ),
};

function Option(props: { label: string; hint: string; icon: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`card flex min-h-[112px] flex-col items-start gap-2 p-4 text-left transition hover:ring-brand-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-brand-500 disabled:opacity-50 ${
        props.active ? "ring-2 ring-brand-500" : ""
      }`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${props.active ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-600"}`}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[props.icon]}
        </svg>
      </span>
      <span className="font-semibold leading-tight text-brand-900">{props.label}</span>
      <span className="text-sm leading-tight text-slate-500">{props.hint}</span>
    </button>
  );
}
