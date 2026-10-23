import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { credenciaisGoogle, ESCOPOS_GOOGLE } from "@/lib/google-calendar";

// Início do login no Google: redireciona para a tela de consentimento. O
// "state" aleatório vai num cookie e é conferido no callback (proteção CSRF).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", request.nextUrl.origin));

  const credenciais = credenciaisGoogle();
  if (!credenciais) {
    return NextResponse.redirect(new URL("/configuracoes?google=sem-credenciais", request.nextUrl.origin));
  }

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: credenciais.clientId,
    redirect_uri: `${request.nextUrl.origin}/api/google-calendar/callback`,
    response_type: "code",
    scope: ESCOPOS_GOOGLE,
    // offline + consent: garante que o Google devolva um refresh token
    // mesmo se a conta já tiver autorizado o app antes.
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();

  const resposta = NextResponse.redirect(url);
  resposta.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/google-calendar",
    maxAge: 600,
  });
  return resposta;
}
