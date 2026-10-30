"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { compressImage, dictationSupported, startDictation } from "./media";
import { Mascot } from "./Mascot";

export const DRAFT_KEY = "sm_draft";
export const DRAFT_PHOTO_KEY = "sm_draft_photo";

const EXAMPLES = [
  ["Chasse d'eau qui coule", "Ma chasse d'eau coule sans arrêt"],
  ["Évier bouché", "Mon évier se vide très lentement"],
  ["Radiateur froid", "Mon radiateur reste froid en haut"],
  ["Lave-linge en panne", "Mon lave-linge ne vidange plus"],
  ["Porte qui frotte", "Ma porte frotte par terre en fermant"],
];

const CATEGORIES: Array<{ label: string; ask: string; bg: string; icon: React.ReactNode }> = [
  { label: "Plomberie", ask: "J'ai une petite fuite sous l'évier", bg: "#e4edff",
    icon: <><path d="M20 9c5 7 8 11 8 15a8 8 0 0 1-16 0c0-4 3-8 8-15z" fill="#3d7bff" /><path d="M16 25a4 4 0 0 0 4 4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></> },
  { label: "Chauffage", ask: "Mon radiateur ne chauffe plus", bg: "#ffe9df",
    icon: <><rect x="10" y="13" width="20" height="16" rx="3" fill="#ff6b2c" /><path d="M15 15v12M20 15v12M25 15v12" stroke="#fff" strokeWidth="2" /></> },
  { label: "Électroménager", ask: "Mon lave-vaisselle affiche une erreur", bg: "#ddf6f1",
    icon: <><rect x="12" y="9" width="16" height="22" rx="3" fill="#22b8a0" /><circle cx="20" cy="22" r="5" fill="#fff" /><circle cx="16" cy="13" r="1.3" fill="#fff" /></> },
  { label: "Bricolage", ask: "Je veux fixer une étagère au mur", bg: "#fff6d9",
    icon: <><rect x="9" y="22" width="22" height="4" rx="1" fill="#e0a100" /><path d="M13 26v4M27 26v4" stroke="#e0a100" strokeWidth="2.5" /><rect x="13" y="13" width="5" height="9" rx="1" fill="#ffc83d" /><rect x="19" y="15" width="4" height="7" rx="1" fill="#ff6b2c" /></> },
  { label: "Entretien", ask: "Le joint de ma douche noircit", bg: "#eee9ff",
    icon: <><path d="M14 28l12-12" stroke="#8b6cff" strokeWidth="5" strokeLinecap="round" /><circle cx="27" cy="13" r="3" fill="#8b6cff" /></> },
  { label: "Jardin", ask: "Ma tondeuse ne démarre pas", bg: "#ddf6f1",
    icon: <><path d="M20 30V18" stroke="#0e7d6c" strokeWidth="2.5" strokeLinecap="round" /><path d="M20 20c-6 0-8-4-8-8 5 0 8 3 8 8zM20 18c0-5 3-8 8-8 0 5-3 8-8 8z" fill="#22b8a0" /></> },
];

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Accueil : on décrit son problème tout de suite. */
export function Starter({ loggedIn }: { loggedIn: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function go() {
    const target = "/depannage/nouveau";
    router.push(loggedIn ? target : `/connexion?next=${encodeURIComponent(target)}`);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return areaRef.current?.focus();
    sessionStorage.setItem(DRAFT_KEY, text.trim());
    go();
  }

  function fill(t: string) {
    setText(t);
    areaRef.current?.focus();
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
    if (listening) return stopRef.current?.();
    if (!dictationSupported()) {
      setNote("La dictée n'est pas disponible sur ce navigateur : utilisez le micro de votre clavier.");
      return areaRef.current?.focus();
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
    <div className="space-y-5">
      {/* Bandeau principal */}
      <section className="relative -mx-1 overflow-hidden rounded-[2rem] bg-tangerine px-5 pb-5 pt-6 text-white">
        <span aria-hidden className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-sun/90" />
        <span aria-hidden className="absolute -bottom-20 -left-8 h-36 w-36 rounded-full bg-tangerine-dark" />
        <div className="relative space-y-4">
          <div className="grid grid-cols-[1fr_7rem] items-end gap-2">
            <h1 className="font-display text-[2rem] font-extrabold leading-[1.02] tracking-tight">
              Un souci à la maison&nbsp;? On répare ensemble.
            </h1>
            <Mascot className="h-28 w-28" />
          </div>
          <p className="text-[1.02rem] text-white/95">
            Décrivez, montrez en photo : Toit-Toit vous guide pas à pas, 24&nbsp;h/24.
          </p>
          <form onSubmit={submit} className="flex items-end gap-2 rounded-3xl bg-white p-1.5 pl-4 shadow-lift">
            <label htmlFor="probleme" className="sr-only">Quel est votre problème ?</label>
            <textarea
              id="probleme"
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={text.length > 40 ? 3 : 1}
              maxLength={4000}
              placeholder={listening ? "Parlez, j'écris…" : "Quel est votre problème ?"}
              className="min-h-[52px] flex-1 resize-none bg-transparent py-3 text-[1.05rem] text-ink placeholder:text-muted focus:outline-none"
            />
            <button type="submit" disabled={busy} aria-label="Obtenir de l'aide"
                    className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-ink text-white">
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" aria-label="Exemples de problèmes">
            {EXAMPLES.map(([label, ask]) => (
              <button key={label} type="button" onClick={() => fill(ask)}
                      className="shrink-0 rounded-full border-[1.5px] border-white/60 bg-ink/20 px-3 py-1.5 text-[0.88rem] font-bold">
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {note && (
        <p role="status" className="rounded-2xl bg-sun-50 px-4 py-3 text-[0.98rem] text-sun-700 ring-2 ring-sun/40">{note}</p>
      )}

      {/* Quatre façons de demander de l'aide */}
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Écrire" hint="En quelques mots" bg="bg-sky-50" ic="bg-sky" onClick={() => areaRef.current?.focus()}
              icon={<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />} />
        <Tile label="Prendre une photo" hint="Toit-Toit regarde pour vous" bg="bg-tangerine-50" ic="bg-tangerine" onClick={() => photoRef.current?.click()} disabled={busy}
              icon={<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>} />
        <Tile label={listening ? "J'écoute… (stop)" : "Parler"} hint="Sans rien taper" bg="bg-mint-50" ic="bg-mint" onClick={toggleDictation} active={listening}
              icon={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>} />
        <Tile label="Montrer en vidéo" hint="Filmez le problème" bg="bg-lilac-50" ic="bg-lilac" onClick={() => photoRef.current?.click()} disabled={busy}
              icon={<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></>} />
      </div>

      <Link href="/artisans" className="flex items-center gap-3 rounded-[1.6rem] bg-ink px-4 py-3.5 text-white">
        <span aria-hidden className="flex">
          {[["PL", "#ffc83d"], ["EL", "#22b8a0"], ["CH", "#ff8f6b"]].map(([t, c], i) => (
            <span key={t} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-ink font-display text-[0.8rem] font-extrabold text-ink ${i ? "-ml-2" : ""}`} style={{ background: c }}>{t}</span>
          ))}
        </span>
        <span className="flex-1">
          <b className="block font-display text-[1.05rem]">Trouver un professionnel</b>
          <small className="text-white/75">Artisans vérifiés près de chez vous</small>
        </span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </Link>

      <section className="space-y-3">
        <h2 className="section-title">On s&apos;occupe de tout ça</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {CATEGORIES.map((c) => (
            <button key={c.label} type="button" onClick={() => fill(c.ask)}
                    className="grid justify-items-center gap-1.5 rounded-3xl border-2 border-line bg-white px-1 pb-2.5 pt-3 text-[0.86rem] font-bold">
              <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden><circle cx="20" cy="20" r="19" fill={c.bg} />{c.icon}</svg>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
    </div>
  );
}

function Tile(props: {
  label: string; hint: string; bg: string; ic: string; icon: React.ReactNode;
  onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled}
            className={`grid min-h-[8rem] content-between gap-2.5 rounded-[1.6rem] p-4 text-left shadow-[inset_0_-5px_0_rgba(27,31,59,.07)] transition active:scale-[.97] disabled:opacity-50 ${props.bg} ${props.active ? "ring-4 ring-mint" : ""}`}>
      <span className={`grid h-12 w-12 place-items-center rounded-2xl text-white ${props.ic}`}>
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{props.icon}</svg>
      </span>
      <span>
        <b className="block font-display text-[1.12rem] leading-tight">{props.label}</b>
        <small className="text-[0.88rem] text-muted">{props.hint}</small>
      </span>
    </button>
  );
}
