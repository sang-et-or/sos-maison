import type { Metadata, Viewport } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { ServiceWorker } from "@/components/ServiceWorker";
import { TabBar } from "@/components/TabBar";

// Titres ronds et chaleureux ; texte très lisible (police conçue pour les personnes malvoyantes).
// Polices hébergées avec le site (licence OFL, sous-ensemble latin) : aucune dépendance à Google Fonts à la compilation.
const display = localFont({ src: "./fonts/BricolageGrotesque.woff", weight: "600 800", variable: "--font-display", display: "swap" });
const body = localFont({
  src: [
    { path: "./fonts/AtkinsonHyperlegible-Regular.woff", weight: "400", style: "normal" },
    { path: "./fonts/AtkinsonHyperlegible-Bold.woff", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOS Maison — un souci à la maison ? On répare ensemble",
  description:
    "Décrivez votre problème, montrez-le en photo : Toit-Toit, l'assistant de SOS Maison, vous guide pas à pas 24 h/24, ou vous oriente vers un artisan vérifié.",
  applicationName: "SOS Maison",
  appleWebApp: { capable: true, title: "SOS Maison", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#ff6b2c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  const initials = user ? (user.display_name || user.email).slice(0, 2).toUpperCase() : null;
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-1 pt-[max(0.9rem,env(safe-area-inset-top))]">
          <Link href="/" className="flex items-center gap-2 font-display text-[1.15rem] font-extrabold tracking-tight" aria-label="SOS Maison, accueil">
            <span className="rounded-lg bg-ink px-1.5 py-0.5 text-[0.82rem] tracking-wider text-white">SOS</span>
            Maison
          </Link>
          <Link href={user ? "/compte" : "/connexion"}
                className={user
                  ? "grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-sun font-display text-sm font-extrabold"
                  : "rounded-full bg-white px-4 py-2 text-sm font-bold shadow-soft ring-2 ring-line"}
                aria-label={user ? "Mon espace" : "Connexion"}>
            {initials ?? "Connexion"}
          </Link>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-8">{children}</main>
        <footer className="mx-auto max-w-2xl px-4 pb-28 text-sm text-muted">
          <p className="mb-2">Conseils indicatifs. En cas de danger, appelez le 112.</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="underline-offset-2 hover:underline">Mentions légales</Link>
            <Link href="/cgu" className="underline-offset-2 hover:underline">Conditions d&apos;utilisation</Link>
            <Link href="/confidentialite" className="underline-offset-2 hover:underline">Confidentialité</Link>
          </nav>
        </footer>
        <TabBar />
        <ServiceWorker />
      </body>
    </html>
  );
}
