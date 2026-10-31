"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Accueil", icon: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /></> },
  { href: "/guides", label: "Guides", icon: <><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" /><path d="M9 9h6M9 13h4" /></> },
  { href: "/artisans", label: "Artisans", icon: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /> },
  { href: "/compte", label: "Mon espace", icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></> },
];

/** Barre d'onglets du bas, comme une application. Masquée dans une conversation. */
export function TabBar() {
  const path = usePathname();
  if (path.startsWith("/depannage")) return null;
  return (
    <nav aria-label="Navigation principale"
         className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-2xl grid-cols-4 px-2 py-1.5">
        {ITEMS.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.8rem] font-bold ${active ? "text-tangerine" : "text-muted"}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {it.icon}
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
