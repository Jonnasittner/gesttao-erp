import { signOut } from "@/lib/auth";

// Encerra a sessão e volta para o login. Usado quando o usuário logado teve o
// acesso removido em Configurações: a sessão é um JWT no cookie, então só
// apagando o cookie (possível em Route Handler, não em Server Component) ele sai.
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
