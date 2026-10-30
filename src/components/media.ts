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
// Dictée vocale (gratuite, faite par le navigateur) : première version de « Parler ».
// La conversation vocale en temps réel avec l'IA arrive au jalon 3.
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
  rec.continuous = true;
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
  rec.onerror = (e) =>
    handlers.onError(
      e.error === "not-allowed"
        ? "Autorisez le micro dans les réglages du navigateur pour dicter votre message."
        : "La dictée s'est arrêtée. Vous pouvez réessayer ou écrire votre message.",
    );
  rec.start();
  return () => rec.stop();
}
