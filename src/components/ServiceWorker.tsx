"use client";
import { useEffect } from "react";

declare global {
  interface Window {
    __smInstall?: { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null;
  }
}

/** Enregistre le service worker et garde la proposition d'installation du navigateur (Android, ordinateur). */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__smInstall = e as unknown as Window["__smInstall"];
      window.dispatchEvent(new Event("sm-install-ready"));
    };
    const onInstalled = () => {
      window.__smInstall = null;
      window.dispatchEvent(new Event("sm-installed"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
