"use client";

/**
 * Réduit une photo du téléphone (souvent 4 à 12 Mo) à 1280 px de côté en JPEG :
 * ~150-400 Ko, assez net pour l'analyse, 10 à 30 fois moins cher à envoyer.
 */
export async function compressImage(file: Blob, maxSide = 1280, quality = 0.8): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() => null);
  let width: number;
  let height: number;
  let source: CanvasImageSource;
  if (bitmap) {
    width = bitmap.width;
    height = bitmap.height;
    source = bitmap;
  } else {
    const img = await loadImage(file);
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(source, 0, 0, w, h);
  bitmap?.close();
  let q = quality;
  let blob = await toBlob(canvas, q);
  while (blob.size > 950_000 && q > 0.4) {
    q -= 0.15;
    blob = await toBlob(canvas, q);
  }
  return { blob, width: w, height: h };
}

function toBlob(canvas: HTMLCanvasElement, q: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression impossible"))), "image/jpeg", q),
  );
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// Dictée vocale (gratuite, faite par le navigateur).
// ---------------------------------------------------------------------------
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function dictationSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startDictation(handlers: {
  onText: (text: string, final: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
  /** false : s'arrête tout seul après un silence (mode mains libres). */
  continuous?: boolean;
}): () => void {
  const w = window as unknown as Record<string, new () => Recognition>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    handlers.onError("La dictée vocale n'est pas disponible sur ce navigateur.");
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = "fr-FR";
  rec.interimResults = true;
  rec.continuous = handlers.continuous ?? true;
  rec.onresult = (e) => {
    let text = "";
    let final = true;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (!e.results[i].isFinal) final = false;
    }
    handlers.onText(text, final);
  };
  rec.onend = handlers.onEnd;
  rec.onerror = (e) => {
    if (e.error === "no-speech" || e.error === "aborted") return; // silence : onend suit
    handlers.onError(
      e.error === "not-allowed"
        ? "Autorisez le micro dans les réglages du navigateur pour dicter votre message."
        : "La dictée s'est arrêtée. Vous pouvez réessayer ou écrire votre message.",
    );
  };
  rec.start();
  return () => rec.stop();
}

// ---------------------------------------------------------------------------
// Lecture à voix haute (synthèse vocale du navigateur, gratuite, hors ligne sur la plupart des téléphones).
// ---------------------------------------------------------------------------
export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/** Retire la mise en forme (gras, renvois [1], liens) pour une lecture naturelle. */
export function toSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*|__|`|#+\s/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe en phrases de moins de 220 caractères (certains navigateurs coupent les lectures longues). */
export function speechChunks(text: string, max = 220): string[] {
  const out: string[] = [];
  for (const sentence of text.match(/[^.!?…]+[.!?…]*/g) ?? []) {
    let s = sentence.trim();
    while (s.length > max) {
      const cut = s.lastIndexOf(" ", max) > 40 ? s.lastIndexOf(" ", max) : max;
      out.push(s.slice(0, cut));
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

/** Lit un texte en français. Retourne une fonction pour interrompre la lecture. */
export function speak(text: string, onEnd?: () => void): () => void {
  if (!speechSupported()) {
    onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const voices = synth.getVoices();
  const voice = voices.find((v) => v.lang === "fr-FR" && /google|natural|premium|enhanced/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("fr"));
  const parts = speechChunks(toSpeech(text));
  let stopped = false;
  if (!parts.length) {
    onEnd?.();
    return () => {};
  }
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.lang = "fr-FR";
    if (voice) u.voice = voice;
    u.rate = 1.02;
    if (i === parts.length - 1) {
      u.onend = () => !stopped && onEnd?.();
      u.onerror = () => !stopped && onEnd?.();
    }
    synth.speak(u);
  });
  return () => {
    stopped = true;
    synth.cancel();
  };
}
