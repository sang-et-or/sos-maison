import { InstallGuide } from "@/components/InstallApp";

export const metadata = { title: "Installer l'appli — SOS Maison" };

export default function InstallPage() {
  return (
    <div className="space-y-5 pt-3">
      <div className="space-y-2">
        <h1 className="font-display text-[1.8rem] font-extrabold leading-tight tracking-tight">Installer l&apos;appli SOS Maison</h1>
        <p className="text-muted">
          SOS Maison s&apos;installe directement depuis le site, sans passer par l&apos;App Store ni Google Play : une icône sur
          votre écran d&apos;accueil, l&apos;appli s&apos;ouvre en plein écran et reste à jour toute seule.
        </p>
      </div>
      <InstallGuide />
    </div>
  );
}
