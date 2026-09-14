// Copia para o Netlify Blobs os arquivos que foram salvos em .data/anexos
// enquanto o sistema rodava localmente (fotos de produto, anexos do CRM).
//
// O Firestore é o mesmo no local e no Netlify, mas o arquivo em si fica em
// lugares diferentes (ver src/lib/anexos-storage.ts): no local vai para o
// disco, no Netlify para o Blobs. Resultado: o registro existe, mas o site
// publicado não acha a imagem.
//
// Uso (precisa de SITE_ID e NETLIFY_BLOBS_TOKEN no .env):
//   node --env-file=.env scripts/enviar-anexos-netlify.mjs          (só lista)
//   node --env-file=.env scripts/enviar-anexos-netlify.mjs --enviar (envia)

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

const SITE_ID = process.env.SITE_ID;
const TOKEN = process.env.NETLIFY_BLOBS_TOKEN;
const ENVIAR = process.argv.includes("--enviar");
const DIRETORIO = path.join(process.cwd(), ".data", "anexos");

if (!SITE_ID || !TOKEN) {
  console.error("Defina SITE_ID e NETLIFY_BLOBS_TOKEN no .env antes de rodar.");
  process.exit(1);
}

async function listarArquivos(dir) {
  const entradas = await readdir(dir, { withFileTypes: true });
  const arquivos = await Promise.all(
    entradas.map((e) => {
      const caminho = path.join(dir, e.name);
      return e.isDirectory() ? listarArquivos(caminho) : [caminho];
    })
  );
  return arquivos.flat();
}

const store = getStore({ name: "anexos", siteID: SITE_ID, token: TOKEN });
const arquivos = await listarArquivos(DIRETORIO);

let jaExistiam = 0;
let enviados = 0;
let pendentes = 0;

for (const caminho of arquivos) {
  // A chave no Blobs é o caminho relativo com "/" (igual ao gravado no Firestore).
  const chave = path.relative(DIRETORIO, caminho).split(path.sep).join("/");

  if (await store.getMetadata(chave)) {
    jaExistiam++;
    continue;
  }

  if (!ENVIAR) {
    pendentes++;
    console.log(`faltando  ${chave}`);
    continue;
  }

  const buffer = await readFile(caminho);
  await store.set(chave, new Blob([buffer]));
  enviados++;
  console.log(`enviado   ${chave}`);
}

console.log(
  `\n${arquivos.length} arquivos locais | já no Netlify: ${jaExistiam} | ` +
    (ENVIAR ? `enviados agora: ${enviados}` : `faltando: ${pendentes} (rode com --enviar)`)
);
