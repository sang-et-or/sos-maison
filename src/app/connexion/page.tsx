import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Mascot } from "@/components/Mascot";

const ERRORS: Record<string, string> = {
  lien: "Ce lien de connexion n'est pas valide. Demandez-en un nouveau.",
  expire: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erreur?: string }> }) {
  const { next, erreur } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await currentUser().catch(() => null)) redirect(safeNext);

  return (
    <div className="space-y-6 pt-8">
      <div className="space-y-2">
        <Mascot className="h-24 w-24" />
        <h1 className="font-display text-[1.8rem] font-extrabold tracking-tight">Se connecter ou créer un compte</h1>
        <p className="text-muted">
          <strong className="text-ink">Déjà inscrit&nbsp;?</strong> Indiquez simplement votre e-mail : nous vous envoyons un lien qui
          vous connecte, sans mot de passe à retenir.
        </p>
        <p className="text-muted">
          <strong className="text-ink">Nouveau&nbsp;?</strong> C&apos;est la même chose : votre compte est créé avec{" "}
          <strong>100 crédits offerts</strong>.
        </p>
      </div>
      {erreur && ERRORS[erreur] && (
        <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-danger-700 ring-1 ring-danger-600/20">{ERRORS[erreur]}</p>
      )}
      <LoginForm next={safeNext} />
    </div>
  );
}
