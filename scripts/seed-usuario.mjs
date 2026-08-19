// Cria/atualiza um usuário de login diretamente no Firestore.
// Uso: node --env-file=.env scripts/seed-usuario.mjs "Nome" email@exemplo.com senha123

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

const [nome, email, senha] = process.argv.slice(2);

if (!nome || !email || !senha) {
  console.error("Uso: node --env-file=.env scripts/seed-usuario.mjs \"Nome\" email@exemplo.com senha123");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env");
  process.exit(1);
}

const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);

const senhaHash = await bcrypt.hash(senha, 10);
const emailNormalizado = email.trim().toLowerCase();

const existente = await db.collection("usuarios").where("email", "==", emailNormalizado).limit(1).get();

if (!existente.empty) {
  await existente.docs[0].ref.update({ nome, senhaHash });
  console.log(`Usuário atualizado: ${emailNormalizado}`);
} else {
  await db.collection("usuarios").add({ nome, email: emailNormalizado, senhaHash, createdAt: new Date() });
  console.log(`Usuário criado: ${emailNormalizado}`);
}

process.exit(0);
