import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Mascot } from "@/components/Mascot";

const ERRORS: Record<string, string> = {
  lien: "Ce lien n'est pas valide. Utilisez « Mot de passe oublié » pour en recevoir un nouveau.",
  expire: "Ce lien a expiré ou a déjà été utilisé. Utilisez « Mot de passe oublié » pour en recevoir un nouveau.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string; mode?: string }> }) {
  const { next, erreur, mode } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await currentUser().catch(() => null)) redirect(safeNext);

  return (
    <div className="space-y-6 pt-8">
      <div className="space-y-2">
        <Mascot className="h-24 w-24" />
        <h1 className="font-display text-[1.8rem] font-extrabold tracking-tight">Bienvenue chez SOS Maison</h1>
        <p className="text-muted">
          Connectez-vous avec votre e-mail et votre mot de passe. Nouveau&nbsp;? Créez votre compte en 30 secondes,
          avec <strong>100 crédits offerts</strong>.
        </p>
      </div>
      {erreur && ERRORS[erreur] && (
        <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-danger-700 ring-1 ring-danger-600/20">{ERRORS[erreur]}</p>
      )}
      <LoginForm next={safeNext} initialMode={mode === "inscription" ? "signup" : "login"} />
    </div>
  );
}
