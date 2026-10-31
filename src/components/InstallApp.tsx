"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Platform = "standalone" | "ios" | "ios-other" | "android" | "desktop";

function detect(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia("(display-mode: standalone)").matches || nav.standalone) return "standalone";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV/.test(ua) ? "ios-other" : "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

const ShareIcon = () => (
  <svg aria-label="Partager" viewBox="0 0 24 24" className="mx-0.5 inline h-5 w-5 -translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 11v9h14v-9" />
  </svg>
);

/** Étapes selon l'appareil, communes au bandeau et à la page. */
function Steps({ platform }: { platform: Platform }) {
  if (platform === "ios")
    return (
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Touchez le bouton <b>Partager</b> <ShareIcon /> en bas de Safari.</li>
        <li>Faites défiler et choisissez <b>Sur l&apos;écran d&apos;accueil</b>.</li>
        <li>Touchez <b>Ajouter</b> : l&apos;icône SOS Maison apparaît avec vos applis.</li>
      </ol>
    );
  if (platform === "ios-other")
    return <p>Sur iPhone, l&apos;installation se fait depuis <b>Safari</b> : ouvrez <b>sos-maison.onrender.com</b> dans Safari, puis Partager <ShareIcon /> → <b>Sur l&apos;écran d&apos;accueil</b>.</p>;
  if (platform === "android")
    return (
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Dans Chrome, touchez le menu <b>⋮</b> en haut à droite.</li>
        <li>Choisissez <b>Installer l&apos;application</b> (ou <b>Ajouter à l&apos;écran d&apos;accueil</b>).</li>
        <li>Confirmez avec <b>Installer</b>.</li>
      </ol>
    );
  return <p>Dans Chrome ou Edge, cliquez l&apos;icône d&apos;installation à droite de la barre d&apos;adresse (un écran avec une flèche), puis <b>Installer</b>. Sur téléphone, c&apos;est encore plus pratique.</p>;
}

function useInstall() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => {
    setPlatform(detect());
    setCanPrompt(Boolean(window.__smInstall));
    const ready = () => setCanPrompt(true);
    const done = () => { setCanPrompt(false); setPlatform("standalone"); };
    window.addEventListener("sm-install-ready", ready);
    window.addEventListener("sm-installed", done);
    return () => { window.removeEventListener("sm-install-ready", ready); window.removeEventListener("sm-installed", done); };
  }, []);
  async function install() {
    const p = window.__smInstall;
    if (!p) return false;
    await p.prompt();
    const { outcome } = await p.userChoice;
    window.__smInstall = null;
    setCanPrompt(false);
    if (outcome === "accepted") setPlatform("standalone");
    return true;
  }
  return { platform, canPrompt, install };
}

/** Bandeau « Installer l'appli » (accueil). Masqué dans l'appli installée ou après « Plus tard ». */
export function InstallCard() {
  const { platform, canPrompt, install } = useInstall();
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem("sm-install-later") === "1"); } catch { setHidden(false); }
  }, []);
  if (!platform || platform === "standalone" || hidden) return null;
  const later = () => { try { localStorage.setItem("sm-install-later", "1"); } catch { /* ignoré */ } setHidden(true); };

  return (
    <section className="relative grid gap-3 overflow-hidden rounded-[1.8rem] bg-sky p-5 text-white" aria-labelledby="installer-titre">
      <span aria-hidden className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-white/15" />
      <div className="relative grid grid-cols-[3.5rem_1fr] items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl ring-4 ring-white/30" />
        <div>
          <b id="installer-titre" className="block font-display text-[1.2rem] font-extrabold leading-tight">SOS Maison sur votre téléphone</b>
          <span className="text-white/85">Une icône, comme une vraie appli. Gratuit, sans store.</span>
        </div>
      </div>
      {open && <div className="relative rounded-2xl bg-white p-4 text-ink"><Steps platform={platform} /></div>}
      <div className="relative grid grid-cols-[1fr_auto] gap-2">
        {canPrompt ? (
          <button onClick={install} className="btn bg-white text-sky-700">Installer l&apos;appli</button>
        ) : (
          <button onClick={() => setOpen(!open)} aria-expanded={open} className="btn bg-white text-sky-700">{open ? "Masquer" : "Comment l'installer ?"}</button>
        )}
        <button onClick={later} className="btn px-4 text-white/90 underline">Plus tard</button>
      </div>
    </section>
  );
}

/** Contenu de la page /installer. */
export function InstallGuide() {
  const { platform, canPrompt, install } = useInstall();
  if (!platform) return null;
  if (platform === "standalone")
    return <p className="rounded-3xl bg-mint-50 p-5 font-bold text-mint-700">C&apos;est fait : vous utilisez déjà l&apos;appli SOS Maison. 🎉</p>;
  const label: Record<Exclude<Platform, "standalone">, string> = { ios: "iPhone ou iPad", "ios-other": "iPhone ou iPad", android: "Android", desktop: "Ordinateur" };
  const others = (["ios", "android", "desktop"] as const).filter((p) => p !== platform && !(platform === "ios-other" && p === "ios"));
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl bg-white p-5">
        <h2 className="section-title">Sur votre appareil ({label[platform]})</h2>
        {canPrompt && <button onClick={install} className="btn-primary w-full">Installer l&apos;appli maintenant</button>}
        <Steps platform={platform} />
      </section>
      {others.map((p) => (
        <details key={p} className="rounded-3xl bg-white p-5">
          <summary className="cursor-pointer font-bold">{label[p]}</summary>
          <div className="mt-3"><Steps platform={p} /></div>
        </details>
      ))}
      <Link href="/" className="btn-soft w-full">Retour à l&apos;accueil</Link>
    </div>
  );
}
