import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

// Em produção (deploy no Netlify) o contexto do Blobs é injetado
// automaticamente via NETLIFY_BLOBS_CONTEXT — getStore("anexos") funciona
// sozinho, sem precisar de credenciais manuais no .env. Em dev local
// (`next dev`, fora do Netlify) esse contexto não existe, então os
// arquivos ficam salvos em disco em `.data/anexos` só para poder testar.
const NA_NETLIFY = Boolean(process.env.NETLIFY_BLOBS_CONTEXT);

const DIRETORIO_LOCAL = path.join(process.cwd(), ".data", "anexos");

function caminhoLocal(chave: string) {
  return path.join(DIRETORIO_LOCAL, chave);
}

export async function salvarAnexo(chave: string, buffer: Buffer) {
  if (NA_NETLIFY) {
    await getStore("anexos").set(chave, new Blob([Uint8Array.from(buffer)]));
    return;
  }
  const caminho = caminhoLocal(chave);
  await mkdir(path.dirname(caminho), { recursive: true });
  await writeFile(caminho, buffer);
}

export async function lerAnexo(chave: string): Promise<Buffer | null> {
  if (NA_NETLIFY) {
    const conteudo = await getStore("anexos").get(chave, { type: "arrayBuffer" });
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
    await getStore("anexos").delete(chave);
    return;
  }
  try {
    await rm(caminhoLocal(chave));
  } catch {
    // já não existe — tudo bem
  }
}
