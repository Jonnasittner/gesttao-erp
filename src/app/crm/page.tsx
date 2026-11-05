import { listarCadastros } from "@/server/cadastros";
import { listarAtendimentos } from "@/server/crm";
import { CrmBoardClient } from "@/components/crm/crm-board-client";
import { PageHeader } from "@/components/ui/page-header";

export default async function CrmPage() {
  const [atendimentos, cadastros] = await Promise.all([listarAtendimentos(), listarCadastros()]);

  return (
    <>
      <PageHeader titulo="CRM" />
      <CrmBoardClient atendimentos={atendimentos} cadastros={cadastros} />
    </>
  );
}
