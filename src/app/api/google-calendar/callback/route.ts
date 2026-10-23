import { after, NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  conexaoRef,
  credenciaisGoogle,
  enviarTodosAgendamentosParaGoogle,
  limparTokenEmCache,
} from "@/lib/google-calendar";

// Volta do Google: troca o "code" pelo refresh token e guarda a conexão.
export async function GET(request: NextRequest) {
  const origem = request.nextUrl.origin;
  const voltar = (resultado: string) => {
    const resposta = NextResponse.redirect(new URL(`/configuracoes?google=${resultado}`, origem));
    resposta.cookies.delete({ name: "google_oauth_state", path: "/api/google-calendar" });
    return resposta;
  };

  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", origem));

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const stateCookie = request.cookies.get("google_oauth_state")?.value;

  if (params.get("error")) return voltar("cancelado");
  if (!code || !state || state !== stateCookie) return voltar("erro");

  const credenciais = credenciaisGoogle();
  if (!credenciais) return voltar("sem-credenciais");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: credenciais.clientId,
      client_secret: credenciais.clientSecret,
      redirect_uri: `${origem}/api/google-calendar/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!resp.ok) {
    console.error("[google-calendar] falha ao trocar code", resp.status, await resp.text());
    return voltar("erro");
  }

  const tokens = (await resp.json()) as { refresh_token?: string; id_token?: string; scope?: string };
  if (!tokens.refresh_token) return voltar("erro");
  // Na tela do Google a permissão da agenda vem numa caixinha que a pessoa
  // pode desmarcar — sem ela a conta "conecta", mas nenhum evento é criado.
  if (!tokens.scope?.split(" ").includes("https://www.googleapis.com/auth/calendar.events")) {
    return voltar("sem-permissao-agenda");
  }

  // O id_token veio direto do endpoint do Google por HTTPS, então dá para
  // só ler o e-mail do payload sem validar a assinatura.
  let email = "";
  if (tokens.id_token) {
    const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString());
    email = payload.email ?? "";
  }

  await conexaoRef().set({
    email,
    refreshToken: tokens.refresh_token,
    conectadoEm: new Date(),
    conectadoPor: session.user.name ?? null,
  });
  limparTokenEmCache();
  // Manda os agendamentos que já existem depois de responder, para a volta
  // do Google não ficar presa esperando (leva ~1s por agendamento).
  after(() => enviarTodosAgendamentosParaGoogle());

  return voltar("conectado");
}
