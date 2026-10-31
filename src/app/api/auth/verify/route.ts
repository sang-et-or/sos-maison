import { NextResponse } from "next/server";
import { consumeLoginToken, setSessionCookie } from "@/lib/auth";
import { publicOrigin } from "@/lib/url";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const base = publicOrigin(req);
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return NextResponse.redirect(new URL("/connexion?erreur=lien", base));
  }
  const sessionId = await consumeLoginToken(token, req.headers.get("user-agent"));
  if (!sessionId) return NextResponse.redirect(new URL("/connexion?erreur=expire", base));
  await setSessionCookie(sessionId);
  return NextResponse.redirect(new URL(next, base));
}
