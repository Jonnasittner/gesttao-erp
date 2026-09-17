/**
 * Reduz uma foto no navegador antes de enviar: no máximo `ladoMaximo` px no
 * maior lado, sempre em JPEG. Foto de celular tem 3–8 MB; assim o envio é
 * rápido, o PDF não fica enorme e formatos que o PDF não lê (WebP, HEIC já
 * convertido pelo navegador) viram JPEG. Só funciona no navegador.
 */
export async function comprimirImagem(arquivo: File, ladoMaximo = 1600, qualidade = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Não foi possível processar a imagem.");

  // Fundo branco: PNG com transparência ficaria preto no JPEG.
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, largura, altura);
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
  if (!blob) throw new Error("Não foi possível processar a imagem.");

  const nome = arquivo.name.replace(/\.[^.]+$/, "") || "foto";
  return new File([blob], `${nome}.jpg`, { type: "image/jpeg" });
}
