import { readFile } from "node:fs/promises";
import path from "node:path";

// Logo e selo da empresa ficam fixos em public/empresa/ (logo.png, selo.png)
// em vez de upload dinâmico — mais simples e sem depender do storage de anexos.
const EXTENSOES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function lerImagemEmpresa(nomeBase: "logo" | "selo"): Promise<string | null> {
  for (const [extensao, tipo] of Object.entries(EXTENSOES)) {
    const caminho = path.join(process.cwd(), "public", "empresa", `${nomeBase}${extensao}`);
    try {
      const buffer = await readFile(caminho);
      return `data:${tipo};base64,${buffer.toString("base64")}`;
    } catch {
      // tenta a próxima extensão
    }
  }
  return null;
}
