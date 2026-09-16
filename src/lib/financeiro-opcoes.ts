import { listarCadastros } from "@/server/cadastros";
import { listarPedidos } from "@/server/pedidos";
import { rotuloPedido } from "@/lib/financeiro";
import type { CadastroOpcao, PedidoOpcao } from "@/components/financeiro/lancamento-form";

/** Listas dos seletores do formulário de lançamento (só no servidor). */
export async function carregarOpcoesLancamento(): Promise<{
  clientes: CadastroOpcao[];
  fornecedores: CadastroOpcao[];
  pedidos: PedidoOpcao[];
}> {
  const [clientes, fornecedores, pedidos] = await Promise.all([
    listarCadastros("CLIENTE"),
    listarCadastros("FORNECEDOR"),
    listarPedidos(),
  ]);

  const porNome = (a: CadastroOpcao, b: CadastroOpcao) => a.label.localeCompare(b.label);

  return {
    clientes: clientes.map((c) => ({ value: c.id, label: c.nome })).sort(porNome),
    fornecedores: fornecedores.map((f) => ({ value: f.id, label: f.nome })).sort(porNome),
    pedidos: pedidos.map((p) => ({
      value: p.id,
      label: rotuloPedido(p.numero, p.status, p.total),
      cadastroId: p.cadastroId,
      total: p.total,
    })),
  };
}
