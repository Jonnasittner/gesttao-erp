import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { auth } from "@/lib/auth";
import { buscarDocumentoFinanceiro } from "@/server/financeiro";
import { formatarCodigo } from "@/lib/codigo";

// Junta num PDF só os boletos de todas as parcelas do documento a que a
// parcela [id] pertence, na ordem das parcelas. Com ?parcela=N, devolve só o
// boleto daquela parcela (o "baixar separados" chama uma vez por parcela).
// Os PDFs vêm do link público do boleto no Asaas (bankSlipUrl).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado", { status: 401 });
  }

  const { id } = await params;
  const parcelas = await buscarDocumentoFinanceiro(id);
  if (!parcelas?.length) {
    return new NextResponse("Lançamento não encontrado", { status: 404 });
  }

  const soParcela = Number(new URL(req.url).searchParams.get("parcela")) || null;
  const comBoleto = parcelas
    .filter((p) => p.asaas?.linkBoleto && (!soParcela || p.parcela === soParcela))
    .sort((a, b) => a.parcela - b.parcela);
  if (comBoleto.length === 0) {
    return new NextResponse(
      soParcela ? `A parcela ${soParcela} não tem boleto gerado.` : "Nenhuma parcela deste documento tem boleto gerado.",
      { status: 404 }
    );
  }

  const final = await PDFDocument.create();
  for (const p of comBoleto) {
    const resp = await fetch(p.asaas!.linkBoleto, { cache: "no-store" });
    const tipo = resp.headers.get("content-type") ?? "";
    if (!resp.ok || !tipo.includes("pdf")) {
      return new NextResponse(`Não foi possível baixar o boleto da parcela ${p.parcela}/${p.totalParcelas} no Asaas.`, {
        status: 502,
      });
    }
    const pdf = await PDFDocument.load(await resp.arrayBuffer());
    const paginas = await final.copyPages(pdf, pdf.getPageIndices());
    for (const pagina of paginas) final.addPage(pagina);
  }

  // "ARBORIS PARQUE RESIDENCIAL - Pedido 0837 - Todas parcelas.pdf" ou "... - Parcela 2.pdf"
  const { clienteNome, pedidoNumero, numeroDocumento } = parcelas[0];
  const nome = [
    clienteNome || "Cliente",
    pedidoNumero ? `Pedido ${formatarCodigo(pedidoNumero)}` : `Documento ${formatarCodigo(numeroDocumento)}`,
    comBoleto.length > 1 ? "Todas parcelas" : `Parcela ${comBoleto[0].parcela}`,
  ]
    .join(" - ")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const bytes = await final.save();
  return new NextResponse(new Blob([Uint8Array.from(bytes)]), {
    headers: {
      "Content-Type": "application/pdf",
      // filename* leva acentos (UTF-8); filename é a versão sem acento para navegadores antigos.
      "Content-Disposition": `attachment; filename="${semAcento(nome)}.pdf"; filename*=UTF-8''${encodeURIComponent(`${nome}.pdf`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[^\x20-\x7e]/g, "");
}
