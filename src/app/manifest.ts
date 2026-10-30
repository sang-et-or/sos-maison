import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SOS Maison",
    short_name: "SOS Maison",
    description: "Votre assistant bricolage intelligent, disponible 24 h/24.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#1f6feb",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
