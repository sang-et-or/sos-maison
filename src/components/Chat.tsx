"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RichText, SourceList, type Source } from "./RichText";
import { RepairCard, confetti } from "./RepairCard";
import { MascotFace } from "./Mascot";
import { compressImage, dictationSupported, speak, speechSupported, startDictation } from "./media";
import { LiveCamera } from "./LiveCamera";
import { DRAFT_KEY, DRAFT_PHOTO_KEY } from "./Starter";
import type { RepairCard as Card } from "@/lib/ai/card";

export interface ChatMessage {
  key: string;
  id: number | null; // identifiant en base (null tant que la réponse n'est pas enregistrée)
  role: "user" | "assistant";
  content: string;
  photos: string[];
  sources: Source[];
  card: Card | null;
  cardDone: number[];
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
  electromenager: "un réparateur",
  multiservices: "un artisan",
};

/** Texte lu à voix haute : la réponse, puis l'essentiel de la fiche si elle existe. */
function spokenAnswer(text: string, card?: Card | null): string {
  if (!card) return text;
  const steps = card.etapes.map((e, i) => `Étape ${i + 1} : ${e}`).join(". ");
  return `${text}. Voici la fiche : ${card.titre}. ${card.securite ? `Sécurité : ${card.securite}. ` : ""}${steps}`;
}

let seq = 0;
const key = () => `m${Date.now()}-${seq++}`;

export function Chat(props: {
  repairId: string | null;
  title: string | null;
  initialMessages: ChatMessage[];
  initialStatus: string;
  proCategory: string | null;
  riskLevel: number;
  balance: number | null;
}) {
  const [repairId, setRepairId] = useState(props.repairId);
  const [title, setTitle] = useState(props.title ?? "Nouveau dépannage");
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
  const [cardComplete, setCardComplete] = useState(() => {
    const lastCard = [...props.initialMessages].reverse().find((m) => m.card);
    return Boolean(lastCard?.card && lastCard.cardDone.length >= lastCard.card.etapes.length);
  });
  const stopDictation = useRef<(() => void) | null>(null);
  const stopSpeaking = useRef<(() => void) | null>(null);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const [camera, setCamera] = useState(false);
  useEffect(() => setCanSpeak(speechSupported()), []);
  useEffect(() => () => { stopSpeaking.current?.(); stopDictation.current?.(); }, []);
  const bottom = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const repairRef = useRef(repairId);
  repairRef.current = repairId;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, emergency, pro, status]);

  const adoptRepair = (id: string, t?: string) => {
    if (t) setTitle(t);
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
    const botKey = key();
    setMessages((m) => [
      ...m,
      { key: key(), id: null, role: "user", content, photos: photos.map((p) => p.url), sources: [], card: null, cardDone: [] },
      { key: botKey, id: null, role: "assistant", content: "", photos: [], sources: [], card: null, cardDone: [], streaming: true },
    ]);
    const patchBot = (f: (b: ChatMessage) => ChatMessage) => setMessages((m) => m.map((x) => (x.key === botKey ? f(x) : x)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repairId: repairRef.current ?? undefined, text: content, photoIds: photos.map((p) => p.id) }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setMessages((m) => m.filter((x) => x.key !== botKey));
        setError({ message: data.error ?? "Toit-Toit est indisponible pour le moment.", code: data.code });
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
            case "repair": adoptRepair(ev.repairId, ev.title); break;
            case "balance": setBalance(ev.balance); if (ev.warning) setWarning(ev.warning); break;
            case "risk": if (ev.pro) setProCategory(ev.pro); break;
            case "emergency": setEmergency(ev.guidance); setStatus("needs_pro"); if (ev.pro) setProCategory(ev.pro); break;
            case "pro": setPro({ category: ev.category, message: ev.message }); if (ev.category) setProCategory(ev.category); break;
            case "status": patchBot((b) => ({ ...b, status: ev.text })); break;
            case "delta": patchBot((b) => ({ ...b, content: b.content + ev.text, status: undefined })); break;
            case "sources": patchBot((b) => ({ ...b, sources: ev.sources })); break;
            case "card": setCardComplete(false); patchBot((b) => ({ ...b, card: ev.card })); break;
            case "notice": setWarning(ev.text); break;
            case "final":
              patchBot((b) => ({ ...b, content: ev.text, sources: ev.sources, card: ev.card ?? b.card, streaming: false, status: undefined }));
              if (handsFreeRef.current) readAloud.current(botKey, spokenAnswer(ev.text, ev.card), true);
              break;
            case "saved": patchBot((b) => ({ ...b, id: ev.messageId })); break;
            case "error": setError({ message: ev.message }); break;
          }
        }
      }
    } catch {
      setError({ message: "La connexion a été interrompue. Votre message a peut-être été reçu : rechargez la page." });
    } finally {
      patchBot((b) => ({ ...b, streaming: false, status: undefined }));
      setMessages((m) => m.filter((x) => !(x.key === botKey && !x.content && !x.card)));
      setBusy(false);
    }
  }, []);

  const sendRef = useRef(send);
  sendRef.current = send;

  // Brouillon venant de l'accueil (texte et/ou photo).
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
    if (s === "resolved") confetti();
    await fetch(`/api/repairs/${repairRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
  }

  // --- Voix : lecture des réponses et mode mains libres (parler, écouter, reparler) ---
  const listenHandsFree = useRef<() => void>(() => {});
  const readAloud = useRef<(k: string, t: string, thenListen?: boolean) => void>(() => {});
  readAloud.current = (k, t, thenListen = false) => {
    stopSpeaking.current?.();
    setSpeakingKey(k);
    stopSpeaking.current = speak(t, () => {
      setSpeakingKey(null);
      if (thenListen && handsFreeRef.current) listenHandsFree.current();
    });
  };
  listenHandsFree.current = () => {
    if (!handsFreeRef.current) return;
    let heard = "";
    setListening(true);
    stopDictation.current = startDictation({
      continuous: false,
      onText: (t) => { heard = t; setText(t); },
      onEnd: () => {
        setListening(false);
        if (!handsFreeRef.current) return;
        if (heard.trim()) sendRef.current(heard, []);
        else stopHandsFree(); // silence : on arrête plutôt que d'écouter sans fin
      },
      onError: (m) => { setError({ message: m }); stopHandsFree(); },
    });
  };
  function stopHandsFree() {
    handsFreeRef.current = false;
    setHandsFree(false);
    setListening(false);
    stopDictation.current?.();
  }
  function toggleHandsFree() {
    if (handsFreeRef.current) {
      stopSpeaking.current?.();
      setSpeakingKey(null);
      return stopHandsFree();
    }
    if (!dictationSupported() || !speechSupported()) {
      setError({ message: "Le mode mains libres a besoin de Chrome, Edge ou Safari récents. Vous pouvez dicter avec le micro du clavier." });
      return;
    }
    handsFreeRef.current = true;
    setHandsFree(true);
    setError(null);
    readAloud.current("hands-free", "Je vous écoute. Décrivez le problème, je vous réponds à voix haute.", true);
  }
  function toggleRead(m: ChatMessage) {
    if (speakingKey === m.key) {
      stopSpeaking.current?.();
      return setSpeakingKey(null);
    }
    readAloud.current(m.key, spokenAnswer(m.content, m.card));
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

  const last = messages.at(-1);
  const lastIdle = !busy && last?.role === "assistant" && !last.streaming;
  const showResolution = status === "open" && lastIdle && (cardComplete || (messages.length >= 4 && !last?.card));
  const proHref = `/artisans${proCategory ? `?metier=${proCategory}` : ""}${repairId ? `${proCategory ? "&" : "?"}depannage=${repairId}` : ""}`;

  return (
    <div className="-mx-4 flex min-h-[calc(100dvh-4rem)] flex-col">
      {/* En-tête de conversation */}
      <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-line bg-white px-3.5 py-2.5">
        <Link href="/compte" aria-label="Mes dépannages" className="grid h-10 w-10 place-items-center rounded-xl bg-paper">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <span className="min-w-0 flex-1">
          <b className="block truncate font-display text-[1.02rem] font-extrabold">{title}</b>
          <small className="font-bold text-mint">● Toit-Toit est là</small>
        </span>
        <span className="whitespace-nowrap rounded-full border-2 border-sun bg-sun-50 px-2.5 py-1 text-[0.85rem] font-bold tabular-nums">
          {balance !== null ? `${balance} crédits` : "Premium"}
        </span>
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        {messages.length === 0 && !busy && (
          <div className="grid grid-cols-[2.25rem_1fr] items-end gap-2">
            <MascotFace />
            <p className="rounded-3xl rounded-bl-lg bg-white px-4 py-3 shadow-soft">
              Bonjour&nbsp;! Je suis Toit-Toit. Décrivez votre problème en quelques mots, ou envoyez-moi une photo.
            </p>
          </div>
        )}

        <ol className="space-y-4" aria-live="polite">
          {messages.map((m) => (
            <li key={m.key}>
              {m.role === "user" ? (
                <div className="ml-auto grid max-w-[84%] justify-items-end gap-2">
                  {m.photos.map((u) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt="Photo envoyée" className="max-h-56 rounded-2xl border-[3px] border-white object-cover shadow-md" />
                  ))}
                  <p className="whitespace-pre-wrap rounded-3xl rounded-br-lg bg-ink px-4 py-2.5 text-white">{m.content}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(m.content || m.streaming) && (
                    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-end gap-2">
                      <MascotFace />
                      <div className="rounded-3xl rounded-bl-lg bg-white px-4 py-3 shadow-soft">
                        {!m.content && (
                          <p className="flex items-center gap-2 text-muted">
                            <span className="inline-flex gap-1" aria-hidden>
                              {[0, 150, 300].map((d) => <i key={d} className="h-2 w-2 animate-hop rounded-full bg-tangerine" style={{ animationDelay: `${d}ms` }} />)}
                            </span>
                            {m.status ?? "Toit-Toit réfléchit…"}
                          </p>
                        )}
                        {m.content && <RichText text={m.content} sources={m.sources} />}
                        {!m.streaming && !m.card && <SourceList sources={m.sources} />}
                        {canSpeak && !m.streaming && m.content && (
                          <button type="button" onClick={() => toggleRead(m)} aria-pressed={speakingKey === m.key}
                                  className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-[0.85rem] font-bold text-muted">
                            {speakingKey === m.key ? "■ Arrêter" : "🔊 Écouter"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {m.card && (
                    <div className="space-y-3">
                      <RepairCard card={m.card} messageId={m.id} initialDone={m.cardDone} sources={m.sources}
                                  onProgress={(d, t) => setCardComplete(d === t)} />
                      {!m.streaming && <SourceList sources={m.sources} />}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>

        {pro && (
          <div className="grid gap-3 rounded-[1.6rem] bg-sun-50 p-4 ring-2 ring-sun">
            <p><b className="font-display text-[1.05rem]">Un professionnel est recommandé</b><br /><span className="text-muted">{pro.message}</span></p>
            <Link href={proHref} className="btn-ink w-full">Trouver {PRO_NAMES[pro.category ?? ""] ?? "un professionnel"}</Link>
          </div>
        )}

        {showResolution && (
          <div className="grid animate-pop gap-3 rounded-[1.6rem] bg-white p-4 shadow-soft">
            <b className="font-display text-[1.1rem]">Ça marche&nbsp;?</b>
            <div className="grid grid-cols-2 gap-2.5">
              <button className="btn-mint" onClick={() => setRepairStatus("resolved")}>Oui, réparé&nbsp;!</button>
              <Link className="btn-soft" href={proHref} onClick={() => setRepairStatus("needs_pro")}>Non, un pro</Link>
            </div>
          </div>
        )}
        {status === "resolved" && (
          <div className="grid animate-pop justify-items-center gap-2 rounded-[1.6rem] bg-mint p-5 text-center text-white">
            <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden><circle cx="32" cy="32" r="32" fill="#fff" /><path d="M18 33l9 9 19-19" stroke="#22b8a0" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <b className="font-display text-[1.35rem]">Bravo, c&apos;est réparé&nbsp;!</b>
            <p>Retrouvez vos réussites et vos économies dans Mon espace.</p>
          </div>
        )}

        {warning && <p role="status" className="rounded-2xl bg-sun-50 px-4 py-3 text-sun-700 ring-2 ring-sun/40">{warning}</p>}
        {error && (
          <div role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-danger-700 ring-2 ring-danger-600/20">
            <p>{error.message}</p>
            {(error.code === "insufficient_credits" || error.code === "premium_cap") && (
              <Link href="/compte#premium" className="mt-2 inline-block font-bold underline">Voir les offres</Link>
            )}
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Saisie */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && !uploading) send(text, pending);
        }}
        className="sticky bottom-0 border-t border-line bg-white px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-2.5"
      >
        <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <button type="button" onClick={() => setCamera(true)} disabled={busy || uploading || pending.length >= 4}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-[0.88rem] font-bold text-sky-700 disabled:opacity-50">
            📹 Caméra en direct
          </button>
          <button type="button" onClick={toggleHandsFree} aria-pressed={handsFree}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.88rem] font-bold ${handsFree ? "bg-mint text-white" : "bg-mint-50 text-mint-700"}`}>
            🎧 {handsFree ? (listening ? "Je vous écoute…" : speakingKey ? "Toit-Toit parle…" : "Mains libres activé") : "Mains libres"}
          </button>
        </div>
        {pending.length > 0 && (
          <div className="mb-2 flex gap-2">
            {pending.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="Photo prête à envoyer" className="h-16 w-16 rounded-xl object-cover ring-2 ring-tangerine" />
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => photoInput.current?.click()} disabled={uploading || busy || pending.length >= 4}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tangerine-50 text-tangerine-dark disabled:opacity-50" aria-label="Prendre ou joindre une photo">
            {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-tangerine border-t-transparent" /> : (
              <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            )}
          </button>
          <button type="button" onClick={toggleDictation} disabled={busy}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl disabled:opacity-50 ${listening ? "bg-mint text-white" : "bg-mint-50 text-mint-700"}`}
                  aria-label={listening ? "Arrêter la dictée" : "Dicter mon message"} aria-pressed={listening}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
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
            placeholder={listening ? "Parlez, j'écris…" : "Écrivez à Toit-Toit…"}
            className="input max-h-40 min-h-12 resize-none py-2.5"
          />
          <button type="submit" disabled={busy || uploading || (!text.trim() && pending.length === 0)}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tangerine text-white disabled:opacity-50" aria-label="Envoyer">
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
        {camera && (
          <LiveCamera remaining={4 - pending.length} onClose={() => setCamera(false)} onCapture={(b) => uploadPhoto(b)} />
        )}
        <input ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden"
               onChange={async (e) => {
                 const f = e.target.files?.[0];
                 e.target.value = "";
                 if (f) await uploadPhoto(f);
               }} />
      </form>

      {emergency && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="urgence-titre"
             className="fixed inset-0 z-50 overflow-y-auto bg-danger-600 px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))] text-white">
          <div className="mx-auto grid max-w-xl gap-4">
            <span className="relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-3xl bg-white">
              <span aria-hidden className="absolute -inset-2 animate-ring rounded-[1.9rem] border-[3px] border-white/60" />
              <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden><path d="M20 7 36 34H4z" fill="#d62839" /><path d="M20 16v9" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" /><circle cx="20" cy="29.5" r="2.2" fill="#fff" /></svg>
            </span>
            <h2 id="urgence-titre" className="font-display text-[2rem] font-extrabold leading-tight">Votre sécurité d&apos;abord</h2>
            {emergency.map((g) => (
              <section key={g.title} className="grid gap-3">
                <span className="w-fit rounded-full bg-black/20 px-3 py-1 font-bold">{g.title}</span>
                <ol className="grid gap-2">
                  {g.steps.map((s, i) => (
                    <li key={s} className="relative rounded-2xl bg-white/[.12] py-2.5 pl-12 pr-3 text-[1.02rem]">
                      <span className="absolute left-3 top-2.5 grid h-[1.6rem] w-[1.6rem] place-items-center rounded-lg bg-white font-display font-extrabold text-danger-600">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="grid gap-2">
                  {g.numbers.map((n) => (
                    <a key={n.tel} href={`tel:${n.tel}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-danger-700">
                      <span>{n.label}</span>
                      <strong className="whitespace-nowrap font-display text-[1.15rem]">{n.display}</strong>
                    </a>
                  ))}
                </div>
              </section>
            ))}
            <Link href={proHref} className="btn bg-white/15 text-white ring-2 ring-white/70">Trouver {PRO_NAMES[proCategory ?? ""] ?? "un professionnel"}</Link>
            <button className="btn text-white underline" onClick={() => setEmergency(null)}>Je suis en sécurité, fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
