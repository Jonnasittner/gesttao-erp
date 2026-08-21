import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

// SITE_ID é injetado de forma garantida em toda função do Netlify (build e
// runtime) — ao contrário de NETLIFY_BLOBS_CONTEXT, que em algumas versões
// do @netlify/plugin-nextjs não chega até os Route Handlers do Next.js
// (só as Server Actions recebem o contexto automático de forma confiável).
// Por isso usamos SITE_ID pra detectar "estamos no Netlify" e passamos
// siteID/token explícitos pro getStore, em vez de confiar na configuração
// automática. NETLIFY_BLOBS_TOKEN é um Personal Access Token criado manualmente
// em Netlify > User settings > Applications > Personal access tokens.
const SITE_ID = process.env.SITE_ID;
const BLOBS_TOKEN = process.env.NETLIFY_BLOBS_TOKEN;
const NA_NETLIFY = Boolean(SITE_ID);

function storeAnexos() {
  if (SITE_ID && BLOBS_TOKEN) {
    return getStore({ name: "anexos", siteID: SITE_ID, token: BLOBS_TOKEN });
  }
  // Sem token explícito: tenta a configuração automática por ambiente como
  // último recurso (funciona em alguns contextos do Netlify).
  return getStore("anexos");
}

const DIRETORIO_LOCAL = path.join(process.cwd(), ".data", "anexos");

function caminhoLocal(chave: string) {
  return path.join(DIRETORIO_LOCAL, chave);
}

export async function salvarAnexo(chave: string, buffer: Buffer) {
  if (NA_NETLIFY) {
    await storeAnexos().set(chave, new Blob([Uint8Array.from(buffer)]));
    return;
  }
  const caminho = caminhoLocal(chave);
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, buffer);
}

export async function lerAnexo(chave: string): Promise<Buffer | null> {
  if (NA_NETLIFY) {
    const conteudo = await storeAnexos().get(chave, { type: "arrayBuffer" });
    return conteudo ? Buffer.from(conteudo) : null;
  }
  try {
    return await readFile(caminhoLocal(chave));
  } catch {
    return null;
  }
}

export async function dataUriDoAnexo(
  chave: string | undefined,
  tipo: string | undefined
): Promise<string | null> {
  if (!chave) return null;
  const conteudo = await lerAnexo(chave);
  if (!conteudo) return null;
  return `data:${tipo || "image/png"};base64,${conteudo.toString("base64")}`;
}

export async function excluirArquivoAnexo(chave: string) {
  if (NA_NETLIFY) {
    await storeAnexos().delete(chave);
    return;
  }
  try {
    await rm(caminhoLocal(chave));
  } catch {
    // já não existe — tudo bem
  }
}
