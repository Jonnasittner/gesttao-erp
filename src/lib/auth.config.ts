import type { NextAuthConfig } from "next-auth";

/**
 * Config compartilhada entre o middleware (runtime Edge) e a config completa
 * do NextAuth (runtime Node). Não pode importar nada que dependa de APIs
 * Node.js (firebase-admin, bcryptjs) — por isso o Credentials provider fica
 * só em auth.ts, não aqui.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
