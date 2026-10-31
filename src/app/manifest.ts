import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SOS Maison",
    short_name: "SOS Maison",
    description: "Un souci à la maison ? Toit-Toit vous aide à réparer, pas à pas, 24 h/24.",
    start_url: "/",
    display: "standalone",
    id: "/",
    scope: "/",
    orientation: "portrait",
    categories: ["lifestyle", "utilities"],
    background_color: "#f4f6fb",
    theme_color: "#ff6b2c",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nouveau dépannage", short_name: "Dépannage", url: "/depannage/nouveau", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Guides d'entretien", short_name: "Guides", url: "/guides", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Trouver un artisan", short_name: "Artisans", url: "/artisans", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
