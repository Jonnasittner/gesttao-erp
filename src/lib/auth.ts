import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/firebase-admin";
import { authConfig } from "@/lib/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const senha = credentials?.senha;
        if (typeof email !== "string" || typeof senha !== "string" || !email || !senha) {
          return null;
        }

        const snap = await db
          .collection("usuarios")
          .where("email", "==", email.trim().toLowerCase())
          .limit(1)
          .get();

        if (snap.empty) return null;

        const doc = snap.docs[0];
        const usuario = doc.data() as { nome: string; email: string; senhaHash: string };

        const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
        if (!senhaValida) return null;

        return { id: doc.id, name: usuario.nome, email: usuario.email };
      },
    }),
  ],
});
