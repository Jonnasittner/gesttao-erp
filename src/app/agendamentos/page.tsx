import { listarCadastros } from "@/server/cadastros";
import { listarAtendimentos } from "@/server/crm";
import { listarPedidos } from "@/server/pedidos";
import { AgendamentosClient } from "@/components/agendamentos/agendamentos-client";

export default async function AgendamentosPage() {
  const [atendimentos, cadastros, pedidos] = await Promise.all([
    listarAtendimentos(),
    listarCadastros(),
    listarPedidos(),
  ]);

  return (
    <AgendamentosClient atendimentos={atendimentos} cadastros={cadastros} pedidos={pedidos} />
  );
}
