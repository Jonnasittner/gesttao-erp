import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Cadastro, Empresa, Pedido } from "@/lib/types";
import { formatarCodigo } from "@/lib/codigo";
import { formatarMoeda } from "@/lib/moeda";

// A fonte base do PDF (Helvetica) não tem glifos de emoji/símbolos — ao
// tentar desenhar um caractere fora do Latin-1 o layout quebra. Mantém
// letras, números, acentuação (á, ç, õ...) e pontuação; remove o resto
// (emoji, símbolos gráficos etc.) só na hora de gerar o PDF, sem alterar
// o texto salvo nem o que aparece na tela do sistema.
function textoSeguroPdf(texto: string): string {
  return texto
    .replace(/[^\t\n\r -ÿ]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingHorizontal: 32, paddingBottom: 64, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
  marcaDaguaContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  marcaDagua: { width: 320, height: 320, objectFit: "contain", opacity: 0.06 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1.5 solid #0f172a",
  },
  logo: { width: 110, height: 80, objectFit: "contain" },
  esquerdaBloco: { flexDirection: "row", alignItems: "center", gap: 12 },
  selo: { width: 95, height: 95, objectFit: "contain" },
  empresaBloco: { alignItems: "flex-start", textAlign: "left", gap: 2 },
  empresaNome: { fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 2 },
  empresaLinha: { fontSize: 8.5, color: "#475569" },
  contatoLinha: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconeSocial: { width: 10, height: 10, objectFit: "contain" },
  tituloBloco: { marginBottom: 12 },
  titulo: { fontSize: 14, fontWeight: 700 },
  subtitulo: { fontSize: 9, color: "#555", marginTop: 2 },
  secao: { marginBottom: 12 },
  secaoTitulo: { fontSize: 9, fontWeight: 700, color: "#555", marginBottom: 3 },
  clienteNome: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  clienteLinha: { fontSize: 9, color: "#333" },
  tabela: { borderTop: "1 solid #ddd", borderLeft: "1 solid #ddd" },
  linha: { flexDirection: "row" },
  linhaCabecalho: { backgroundColor: "#f2f2f2" },
  celula: {
    borderRight: "1 solid #ddd",
    borderBottom: "1 solid #ddd",
    padding: 5,
  },
  celulaCabecalho: { fontWeight: 700 },
  celulaImagem: { width: 40, justifyContent: "center", alignItems: "center" },
  imagemProduto: { width: 28, height: 28, objectFit: "cover", borderRadius: 2 },
  colProduto: { flex: 3 },
  colMedida: { flex: 1.3, textAlign: "center" },
  colQtd: { flex: 0.8, textAlign: "center" },
  colPreco: { flex: 1.2, textAlign: "right" },
  colSubtotal: { flex: 1.2, textAlign: "right" },
  totalBloco: { marginTop: 14, alignItems: "flex-end" },
  totalLabel: { fontSize: 9, color: "#555" },
  totalValor: { fontSize: 15, fontWeight: 700 },
  observacaoBloco: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    paddingTop: 6,
    borderTop: "1 solid #ddd",
  },
  observacaoTexto: { fontSize: 8, color: "#555", lineHeight: 1.4 },
  fotosBloco: { marginTop: 16 },
  fotosLinha: { flexDirection: "row", gap: 8, marginBottom: 8 },
  fotoCaixa: {
    width: 171,
    height: 128,
    border: "1 solid #ddd",
    borderRadius: 3,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  foto: { width: "100%", height: "100%", objectFit: "contain" },
});

const FOTOS_POR_LINHA = 3;

/**
 * As observações ficam presas no rodapé de todas as páginas (position absolute);
 * a margem de baixo da página cresce com o texto para o conteúdo (tabela,
 * fotos) não passar por cima delas.
 */
function margemInferior(observacao: string): number {
  if (!observacao) return 40;
  const linhas = observacao
    .split("\n")
    .reduce((total, linha) => total + Math.max(1, Math.ceil(linha.length / 115)), 0);
  const alturaObservacao = 18 + linhas * 11.2; // título + linhas (fonte 8 × altura 1,4)
  return Math.max(64, Math.round(alturaObservacao + 20 + 14));
}

import { formatarCpfCnpj } from "@/lib/documento";

function OrcamentoDocument({
  pedido,
  cliente,
  empresa,
  logoDataUri,
  seloDataUri,
  whatsappDataUri,
  instagramDataUri,
  siteDataUri,
  emailDataUri,
  imagensProdutos,
  previa,
  fotos = [],
}: {
  pedido: Pedido;
  cliente: Cadastro | null;
  empresa: Empresa | null;
  logoDataUri: string | null;
  seloDataUri: string | null;
  whatsappDataUri?: string | null;
  instagramDataUri?: string | null;
  siteDataUri?: string | null;
  emailDataUri?: string | null;
  imagensProdutos: Record<string, string | null>;
  /** Prévia antes de salvar: orçamento novo ainda não tem número. */
  previa?: boolean;
  /** Fotos do orçamento (data URIs), exibidas acima das observações. */
  fotos?: string[];
}) {
  const linhasDeFotos: string[][] = [];
  for (let i = 0; i < fotos.length; i += FOTOS_POR_LINHA) {
    linhasDeFotos.push(fotos.slice(i, i + FOTOS_POR_LINHA));
  }
  const observacao = pedido.observacao ? textoSeguroPdf(pedido.observacao) : "";

  const enderecoCliente = cliente
    ? [cliente.endereco, cliente.numero, cliente.bairro, cliente.cidade, cliente.estado].filter(Boolean).join(", ")
    : "";

  return (
    <Document>
      <Page size="A4" style={[styles.page, { paddingBottom: margemInferior(observacao) }]}>
        {logoDataUri ? (
          <View style={styles.marcaDaguaContainer} fixed>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoDataUri} style={styles.marcaDagua} />
          </View>
        ) : null}

        <View style={styles.header}>
          <View style={styles.esquerdaBloco}>
            {logoDataUri ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoDataUri} style={styles.logo} />
            ) : null}
            <View style={styles.empresaBloco}>
              <Text style={styles.empresaNome}>{empresa?.nome || "SUA EMPRESA"}</Text>
              {empresa?.cnpj ? <Text style={styles.empresaLinha}>CNPJ: {empresa.cnpj}</Text> : null}
              {empresa?.endereco ? <Text style={styles.empresaLinha}>{empresa.endereco}</Text> : null}
              {empresa?.telefone ? (
                <View style={styles.contatoLinha}>
                  {whatsappDataUri ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={whatsappDataUri} style={styles.iconeSocial} />
                  ) : null}
                  <Text style={styles.empresaLinha}>{empresa.telefone}</Text>
                </View>
              ) : null}
              {empresa?.instagram ? (
                <View style={styles.contatoLinha}>
                  {instagramDataUri ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={instagramDataUri} style={styles.iconeSocial} />
                  ) : null}
                  <Text style={styles.empresaLinha}>{empresa.instagram}</Text>
                </View>
              ) : null}
              {empresa?.email ? (
                <View style={styles.contatoLinha}>
                  {emailDataUri ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={emailDataUri} style={styles.iconeSocial} />
                  ) : null}
                  <Text style={styles.empresaLinha}>{empresa.email}</Text>
                </View>
              ) : null}
              {empresa?.site ? (
                <View style={styles.contatoLinha}>
                  {siteDataUri ? (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={siteDataUri} style={styles.iconeSocial} />
                  ) : null}
                  <Text style={styles.empresaLinha}>{empresa.site}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {seloDataUri ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={seloDataUri} style={styles.selo} />
          ) : (
            <View />
          )}
        </View>

        <View style={styles.tituloBloco}>
          <Text style={styles.titulo}>
            {pedido.status === "PEDIDO" ? "Pedido" : "Orçamento"}{" "}
            {pedido.numero ? formatarCodigo(pedido.numero) : ""}
          </Text>
          <Text style={styles.subtitulo}>
            Data: {new Date(pedido.createdAt).toLocaleDateString("pt-BR")}
            {previa ? "  ·  PRÉVIA — AINDA NÃO SALVO" : ""}
          </Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>CLIENTE</Text>
          <Text style={styles.clienteNome}>{pedido.cadastroNome}</Text>
          {cliente?.documento ? (
            <Text style={styles.clienteLinha}>CNPJ/CPF: {formatarCpfCnpj(cliente.documento)}</Text>
          ) : null}
          {cliente?.telefone ? <Text style={styles.clienteLinha}>Telefone: {cliente.telefone}</Text> : null}
          {enderecoCliente ? <Text style={styles.clienteLinha}>{enderecoCliente}</Text> : null}
        </View>

        <View style={styles.tabela}>
          <View style={[styles.linha, styles.linhaCabecalho]}>
            <View style={[styles.celula, styles.celulaCabecalho, styles.celulaImagem]}>
              <Text>Img.</Text>
            </View>
            <Text style={[styles.celula, styles.celulaCabecalho, styles.colProduto]}>Produto</Text>
            <Text style={[styles.celula, styles.celulaCabecalho, styles.colMedida]}>Medida</Text>
            <Text style={[styles.celula, styles.celulaCabecalho, styles.colQtd]}>Qtd.</Text>
            <Text style={[styles.celula, styles.celulaCabecalho, styles.colPreco]}>Preço unit.</Text>
            <Text style={[styles.celula, styles.celulaCabecalho, styles.colSubtotal]}>Subtotal</Text>
          </View>
          {pedido.itens.map((item, index) => (
            <View key={index} style={styles.linha}>
              <View style={[styles.celula, styles.celulaImagem]}>
                {imagensProdutos[item.produtoId] ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={imagensProdutos[item.produtoId]!} style={styles.imagemProduto} />
                ) : null}
              </View>
              <Text style={[styles.celula, styles.colProduto]}>{item.produtoNome}</Text>
              <Text style={[styles.celula, styles.colMedida]}>
                {item.comprimento && item.largura ? `${item.comprimento}x${item.largura}cm` : "-"}
              </Text>
              <Text style={[styles.celula, styles.colQtd]}>{item.quantidade}</Text>
              <Text style={[styles.celula, styles.colPreco]}>{formatarMoeda(item.precoUnitario)}</Text>
              <Text style={[styles.celula, styles.colSubtotal]}>
                {formatarMoeda(item.quantidade * item.precoUnitario)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalBloco}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{formatarMoeda(pedido.total)}</Text>
        </View>

        {linhasDeFotos.length > 0 ? (
          <View style={styles.fotosBloco}>
            <Text style={styles.secaoTitulo} minPresenceAhead={140}>
              FOTOS
            </Text>
            {linhasDeFotos.map((linha, indice) => (
              // Cada linha de fotos fica inteira na mesma página.
              <View key={indice} style={styles.fotosLinha} wrap={false}>
                {linha.map((foto, i) => (
                  <View key={i} style={styles.fotoCaixa}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image src={foto} style={styles.foto} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {observacao ? (
          <View style={styles.observacaoBloco} fixed>
            <Text style={styles.secaoTitulo}>OBSERVAÇÕES</Text>
            <Text style={styles.observacaoTexto}>{observacao}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderOrcamentoPdf(props: {
  pedido: Pedido;
  cliente: Cadastro | null;
  empresa: Empresa | null;
  logoDataUri: string | null;
  seloDataUri: string | null;
  whatsappDataUri?: string | null;
  instagramDataUri?: string | null;
  siteDataUri?: string | null;
  emailDataUri?: string | null;
  imagensProdutos: Record<string, string | null>;
  previa?: boolean;
  fotos?: string[];
}): Promise<Buffer> {
  return renderToBuffer(<OrcamentoDocument {...props} />);
}
