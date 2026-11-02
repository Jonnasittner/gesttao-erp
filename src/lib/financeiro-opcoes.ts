import { listarCadastros } from "@/server/cadastros";
import { listarPedidos } from "@/server/pedidos";
import { listarBancosUsados } from "@/server/financeiro";
import { listarClassesDespesa } from "@/server/classes-despesa";
import { rotuloPedido } from "@/lib/financeiro";
import type { ClasseDespesa } from "@/lib/types";
import type { CadastroOpcao, PedidoOpcao } from "@/components/financeiro/lancamento-form";

/** Listas dos seletores do formulário de lançamento (só no servidor). */
export async function carregarOpcoesLancamento(): Promise<{
  clientes: CadastroOpcao[];
  fornecedores: CadastroOpcao[];
  pedidos: PedidoOpcao[];
  bancosUsados: string[];
  classes: ClasseDespesa[];
}> {
  const [clientes, fornecedores, pedidos, bancosUsados, classes] = await Promise.all([
    listarCadastros("CLIENTE"),
    listarCadastros("FORNECEDOR"),
    listarPedidos(),
    listarBancosUsados(),
    listarClassesDespesa(),
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
    bancosUsados,
    classes,
  };
}
