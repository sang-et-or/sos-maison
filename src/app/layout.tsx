import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "SOS Maison — votre assistant bricolage intelligent",
  description:
    "Un problème à la maison ? Décrivez-le, montrez-le en photo : l'assistant SOS Maison vous guide pas à pas, 24 h/24, ou vous oriente vers un professionnel.",
  applicationName: "SOS Maison",
  appleWebApp: { capable: true, title: "SOS Maison", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#1f6feb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="fr">
      <body className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-900" aria-label="SOS Maison, accueil">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500 text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11.5 12 4l9 7.5" />
                  <path d="M5.5 10v9.5h13V10" />
                  <path d="M12 13v3.5M12 19h.01" />
                </svg>
              </span>
              SOS Maison
            </Link>
            <nav className="flex items-center gap-1 text-[0.95rem]">
              <Link href="/artisans" className="rounded-xl px-3 py-2 font-medium text-brand-900 hover:bg-brand-50">
                Artisans
              </Link>
              <Link href={user ? "/compte" : "/connexion"} className="rounded-xl px-3 py-2 font-medium text-brand-900 hover:bg-brand-50">
                {user ? "Mon compte" : "Connexion"}
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 pb-16">{children}</main>
        <footer className="mx-auto max-w-2xl px-4 pb-10 text-sm text-slate-500">
          <p className="mb-2">
            Les conseils de SOS Maison sont fournis à titre indicatif. En cas de danger, appelez le 112.
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="underline-offset-2 hover:underline">Mentions légales</Link>
            <Link href="/cgu" className="underline-offset-2 hover:underline">Conditions d&apos;utilisation</Link>
            <Link href="/confidentialite" className="underline-offset-2 hover:underline">Confidentialité</Link>
          </nav>
        </footer>
        <ServiceWorker />
      </body>
    </html>
  );
}
