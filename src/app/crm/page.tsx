import { listarCadastros } from "@/server/cadastros";
import { listarAtendimentos } from "@/server/crm";
import { CrmBoardClient } from "@/components/crm/crm-board-client";

export default async function CrmPage() {
  const [atendimentos, cadastros] = await Promise.all([listarAtendimentos(), listarCadastros()]);

  return <CrmBoardClient atendimentos={atendimentos} cadastros={cadastros} />;
}
