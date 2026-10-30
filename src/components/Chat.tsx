"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RichText, SourceList, type Source } from "./RichText";
import { compressImage, dictationSupported, startDictation } from "./media";
import { DRAFT_KEY, DRAFT_PHOTO_KEY } from "./Starter";

export interface ChatMessage {
  key: string;
  role: "user" | "assistant";
  content: string;
  photos: string[]; // URL d'affichage
  sources: Source[];
  status?: string;
  streaming?: boolean;
}

interface Guidance {
  title: string;
  steps: string[];
  numbers: { label: string; tel: string; display: string }[];
}

const PRO_NAMES: Record<string, string> = {
  plombier: "un plombier",
  electricien: "un électricien",
  chauffagiste: "un chauffagiste",
  serrurier: "un serrurier",
  electromenager: "un réparateur d'électroménager",
  multiservices: "un artisan multiservices",
};

let seq = 0;
const key = () => `m${Date.now()}-${seq++}`;

export function Chat(props: {
  repairId: string | null;
  initialMessages: ChatMessage[];
  initialStatus: string;
  proCategory: string | null;
  riskLevel: number;
  balance: number | null;
}) {
  const [repairId, setRepairId] = useState(props.repairId);
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<{ id: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [emergency, setEmergency] = useState<Guidance[] | null>(null);
  const [pro, setPro] = useState<{ category?: string; message: string } | null>(
    props.riskLevel >= 3 ? { category: props.proCategory ?? undefined, message: "Ce dépannage nécessite un professionnel qualifié." } : null,
  );
  const [proCategory, setProCategory] = useState(props.proCategory);
  const [status, setStatus] = useState(props.initialStatus);
  const [balance, setBalance] = useState(props.balance);
  const [warning, setWarning] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const stopDictation = useRef<(() => void) | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const repairRef = useRef(repairId);
  repairRef.current = repairId;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, emergency, pro]);

  const adoptRepair = (id: string) => {
    if (repairRef.current) return;
    repairRef.current = id;
    setRepairId(id);
    window.history.replaceState(null, "", `/depannage/${id}`);
  };

  const uploadPhoto = useCallback(async (file: Blob) => {
    setUploading(true);
    setError(null);
    try {
      const { blob, width, height } = await compressImage(file);
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      form.append("width", String(width));
      form.append("height", String(height));
      if (repairRef.current) form.append("repairId", repairRef.current);
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error, code: data.code });
        return null;
      }
      adoptRepair(data.repairId);
      if (data.balance !== undefined) setBalance(data.balance);
      if (data.warning) setWarning(data.warning);
      const item = { id: data.id as string, url: URL.createObjectURL(blob) };
      setPending((p) => [...p, item]);
      return item;
    } catch {
      setError({ message: "La photo n'a pas pu être envoyée. Vérifiez votre connexion et réessayez." });
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const send = useCallback(async (raw: string, photos: { id: string; url: string }[]) => {
    const content = raw.trim() || (photos.length ? "Voici une photo du problème." : "");
    if (!content) return;
    setBusy(true);
    setError(null);
    setText("");
    setPending([]);
    const userKey = key();
    const botKey = key();
    setMessages((m) => [
      ...m,
      { key: userKey, role: "user", content, photos: photos.map((p) => p.url), sources: [] },
      { key: botKey, role: "assistant", content: "", photos: [], sources: [], streaming: true, status: "L'assistant réfléchit…" },
    ]);
    const patchBot = (f: (b: ChatMessage) => ChatMessage) =>
      setMessages((m) => m.map((x) => (x.key === botKey ? f(x) : x)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repairId: repairRef.current ?? undefined, text: content, photoIds: photos.map((p) => p.id) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => m.filter((x) => x.key !== botKey));
        setError({ message: data.error ?? "L'assistant est indisponible.", code: data.code });
        if (res.status === 401) window.location.href = `/connexion?next=${encodeURIComponent(location.pathname)}`;
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          switch (ev.type) {
            case "repair":
              adoptRepair(ev.repairId);
              break;
            case "balance":
              setBalance(ev.balance);
              if (ev.warning) setWarning(ev.warning);
              break;
            case "risk":
              if (ev.pro) setProCategory(ev.pro);
              break;
            case "emergency":
              setEmergency(ev.guidance);
              setStatus("needs_pro");
              if (ev.pro) setProCategory(ev.pro);
              break;
            case "pro":
              setPro({ category: ev.category, message: ev.message });
              if (ev.category) setProCategory(ev.category);
              break;
            case "status":
              patchBot((b) => ({ ...b, status: ev.text }));
              break;
            case "delta":
              patchBot((b) => ({ ...b, content: b.content + ev.text, status: undefined }));
              break;
            case "sources":
              patchBot((b) => ({ ...b, sources: ev.sources }));
              break;
            case "notice":
              setWarning(ev.text);
              break;
            case "final":
              patchBot((b) => ({ ...b, content: ev.text, sources: ev.sources, streaming: false, status: undefined }));
              break;
            case "error":
              setError({ message: ev.message });
              break;
          }
        }
      }
    } catch {
      setError({ message: "La connexion a été interrompue. Votre message a peut-être été reçu : rechargez la page." });
    } finally {
      patchBot((b) => ({ ...b, streaming: false, status: undefined }));
      setMessages((m) => m.filter((x) => !(x.key === botKey && !x.content)));
      setBusy(false);
    }
  }, []);

  // Brouillon venant de la page d'accueil (texte et/ou photo).
  useEffect(() => {
    if (started.current || props.repairId) return;
    started.current = true;
    const draft = sessionStorage.getItem(DRAFT_KEY) ?? "";
    const photo = sessionStorage.getItem(DRAFT_PHOTO_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_PHOTO_KEY);
    (async () => {
      let photos: { id: string; url: string }[] = [];
      if (photo) {
        const blob = await (await fetch(photo)).blob();
        const p = await uploadPhoto(blob);
        if (p) photos = [p];
      }
      if (draft || photos.length) await send(draft, photos);
    })();
  }, [props.repairId, send, uploadPhoto]);

  async function setRepairStatus(s: "resolved" | "needs_pro") {
    if (!repairRef.current) return;
    setStatus(s);
    await fetch(`/api/repairs/${repairRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
  }

  function toggleDictation() {
    if (listening) return stopDictation.current?.();
    if (!dictationSupported()) {
      setError({ message: "La dictée n'est pas disponible ici : utilisez le micro de votre clavier." });
      return;
    }
    const before = text ? text.trim() + " " : "";
    setListening(true);
    stopDictation.current = startDictation({
      onText: (t) => setText(before + t),
      onEnd: () => setListening(false),
      onError: (m) => {
        setError({ message: m });
        setListening(false);
      },
    });
  }

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const showResolution = !busy && lastAssistant && !lastAssistant.streaming && status === "open" && messages.length >= 4;
  const proHref = `/artisans${proCategory ? `?metier=${proCategory}` : ""}`;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col pt-4">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
        <Link href="/compte" className="underline-offset-2 hover:underline">← Mes dépannages</Link>
        {balance !== null ? <span>{balance} crédits</span> : <span>Premium</span>}
      </div>

      {messages.length === 0 && !busy && (
        <div className="card mb-4">
          <p className="text-lg font-semibold text-brand-900">Décrivez votre problème</p>
          <p className="text-slate-600">Quelques mots suffisent. Vous pouvez aussi envoyer une photo.</p>
        </div>
      )}

      <ol className="flex-1 space-y-4" aria-live="polite">
        {messages.map((m) => (
          <li key={m.key} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] space-y-2">
                {m.photos.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="Photo envoyée" className="ml-auto max-h-60 rounded-2xl object-cover" />
                ))}
                <p className="whitespace-pre-wrap rounded-3xl rounded-br-lg bg-brand-500 px-4 py-3 text-white">{m.content}</p>
              </div>
            ) : (
              <div className="card rounded-bl-lg">
                {m.status && !m.content && (
                  <p className="flex items-center gap-2 text-slate-500">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-500" /> {m.status}
                  </p>
                )}
                {m.content && <RichText text={m.content} sources={m.sources} />}
                {!m.streaming && <SourceList sources={m.sources} />}
              </div>
            )}
          </li>
        ))}
      </ol>

      {pro && (
        <div className="card mt-4 border-l-4 border-warm-500">
          <p className="font-semibold text-brand-900">Un professionnel est recommandé</p>
          <p className="text-slate-600">{pro.message}</p>
          <Link href={proHref} className="btn-primary mt-3 w-full">
            Trouver {PRO_NAMES[pro.category ?? ""] ?? "un professionnel"}
          </Link>
        </div>
      )}

      {showResolution && (
        <div className="card mt-4">
          <p className="font-semibold text-brand-900">Votre problème est-il résolu&nbsp;?</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button className="btn-soft" onClick={() => setRepairStatus("resolved")}>Oui, merci&nbsp;!</button>
            <Link className="btn-soft" href={proHref} onClick={() => setRepairStatus("needs_pro")}>Non, un pro</Link>
          </div>
        </div>
      )}
      {status === "resolved" && (
        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800 ring-1 ring-emerald-200">
          Bravo&nbsp;! Ce dépannage est marqué comme résolu. Vous pouvez continuer à poser des questions.
        </p>
      )}

      {warning && <p role="status" className="mt-4 rounded-2xl bg-warm-50 px-4 py-3 text-amber-900 ring-1 ring-warm-100">{warning}</p>}
      {error && (
        <div role="alert" className="mt-4 rounded-2xl bg-danger-50 px-4 py-3 text-danger-700 ring-1 ring-red-200">
          <p>{error.message}</p>
          {(error.code === "insufficient_credits" || error.code === "premium_cap") && (
            <Link href="/compte#premium" className="mt-2 inline-block font-semibold underline">Voir les offres</Link>
          )}
        </div>
      )}
      <div ref={bottom} />

      {/* Barre de saisie */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !uploading) send(text, pending);
        }}
        className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-200 bg-[#f7f9fc]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        {pending.length > 0 && (
          <div className="mb-2 flex gap-2">
            {pending.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="Photo prête à envoyer" className="h-16 w-16 rounded-xl object-cover ring-2 ring-brand-500" />
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading || busy || pending.length >= 4}
                  className="btn-soft h-[52px] w-[52px] shrink-0 px-0" aria-label="Prendre ou joindre une photo">
            {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> : (
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            )}
          </button>
          <button type="button" onClick={toggleDictation} disabled={busy}
                  className={`btn-soft h-[52px] w-[52px] shrink-0 px-0 ${listening ? "!bg-brand-500 !text-white" : ""}`}
                  aria-label={listening ? "Arrêter la dictée" : "Dicter mon message"} aria-pressed={listening}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          </button>
          <label htmlFor="message" className="sr-only">Votre message</label>
          <textarea
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                if (!busy && !uploading) send(text, pending);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={listening ? "Parlez, j'écris…" : "Écrivez votre message"}
            className="input max-h-40 min-h-[52px] resize-none py-3"
          />
          <button type="submit" disabled={busy || uploading || (!text.trim() && pending.length === 0)}
                  className="btn-primary h-[52px] w-[52px] shrink-0 px-0" aria-label="Envoyer">
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
        <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden"
               onChange={async (e) => {
                 const f = e.target.files?.[0];
                 e.target.value = "";
                 if (f) await uploadPhoto(f);
               }} />
      </form>

      {emergency && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="urgence-titre"
             className="fixed inset-0 z-50 overflow-y-auto bg-danger-700 px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
          <div className="mx-auto max-w-xl space-y-5">
            <h2 id="urgence-titre" className="text-2xl font-extrabold">Votre sécurité d&apos;abord</h2>
            {emergency.map((g) => (
              <section key={g.title} className="space-y-3">
                <h3 className="text-xl font-bold">{g.title}</h3>
                <ol className="list-decimal space-y-2 pl-6 text-lg">
                  {g.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
                <div className="grid gap-2">
                  {g.numbers.map((n) => (
                    <a key={n.tel} href={`tel:${n.tel}`} className="btn w-full bg-white text-danger-700">
                      Appeler {n.label} · {n.display}
                    </a>
                  ))}
                </div>
              </section>
            ))}
            <div className="grid gap-2 pt-2">
              <Link href={proHref} className="btn w-full bg-danger-600 ring-2 ring-white/70">Trouver un professionnel</Link>
              <button className="btn w-full text-white/90 underline" onClick={() => setEmergency(null)}>
                Je suis en sécurité, fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
