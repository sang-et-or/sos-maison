/** Toit-Toit, la mascotte de SOS Maison (dessin original). */
export function Mascot({ className = "h-28 w-28", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label="Toit-Toit, la mascotte de SOS Maison">
      <ellipse cx="62" cy="113" rx="34" ry="5" fill="#1b1f3b" opacity=".18" />
      <path d="M24 56 62 22l38 34v50a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="#fff" stroke="#1b1f3b" strokeWidth="4" strokeLinejoin="round" />
      <path d="M16 60 62 18l46 42" fill="none" stroke="#1b1f3b" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="80" y="26" width="10" height="18" rx="2" fill="#1b1f3b" />
      <g className={animated ? "origin-center animate-blink" : undefined} style={{ transformBox: "fill-box" }}>
        <ellipse cx="50" cy="66" rx="5" ry="6.5" fill="#1b1f3b" />
        <ellipse cx="74" cy="66" rx="5" ry="6.5" fill="#1b1f3b" />
      </g>
      <circle cx="51.5" cy="64" r="1.7" fill="#fff" />
      <circle cx="75.5" cy="64" r="1.7" fill="#fff" />
      <ellipse cx="41" cy="77" rx="5" ry="3" fill="#ff6b2c" opacity=".55" />
      <ellipse cx="83" cy="77" rx="5" ry="3" fill="#ff6b2c" opacity=".55" />
      <path d="M54 80q8 7 16 0" fill="none" stroke="#1b1f3b" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="54" y="90" width="16" height="22" rx="3" fill="#ffc83d" stroke="#1b1f3b" strokeWidth="3" />
      <g className={animated ? "animate-wave" : undefined} style={{ transformOrigin: "30px 72px" }}>
        <path d="M27 74 12 60" stroke="#1b1f3b" strokeWidth="5" strokeLinecap="round" />
        <path d="M6 50a7 7 0 1 0 11 3l-5 5 6 6 5-5a7 7 0 1 0 3-11" fill="#3d7bff" stroke="#1b1f3b" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Petit avatar de Toit-Toit à côté des messages de l'assistant. */
export function MascotFace({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#ff6b2c" />
      <path d="M8 18 18 9l10 9v9H8z" fill="#fff" />
      <circle cx="15" cy="20" r="1.6" fill="#1b1f3b" />
      <circle cx="21" cy="20" r="1.6" fill="#1b1f3b" />
      <path d="M15.5 23.5q2.5 2 5 0" stroke="#1b1f3b" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
