"use client";
import { useEffect } from "react";

/** Enregistre le service worker (site installable sur l'écran d'accueil). */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
