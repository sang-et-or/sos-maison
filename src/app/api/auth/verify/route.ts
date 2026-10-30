import { NextResponse } from "next/server";
import { consumeLoginToken, setSessionCookie } from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return NextResponse.redirect(new URL("/connexion?erreur=lien", url));
  }
  const sessionId = await consumeLoginToken(token, req.headers.get("user-agent"));
  if (!sessionId) return NextResponse.redirect(new URL("/connexion?erreur=expire", url));
  await setSessionCookie(sessionId);
  return NextResponse.redirect(new URL(next, url));
}
