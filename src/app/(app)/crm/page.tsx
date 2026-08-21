import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtapaInteracaoSelect } from "@/components/crm/etapa-interacao-select";
import { ReagendarInteracao } from "@/components/crm/reagendar-interacao";
import { listarCadastros } from "@/server/cadastros";
import { listarAtendimentos } from "@/server/crm";
import { ETAPA_ATENDIMENTO } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO } from "@/lib/rotulos";

export default async function CrmPage() {
  const [atendimentos, cadastros] = await Promise.all([listarAtendimentos(), listarCadastros()]);
  const nomePorCadastro = new Map(cadastros.map((c) => [c.id, c.nome]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">CRM — Funil de atendimentos</h1>

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8">
        {ETAPA_ATENDIMENTO.map((etapa) => {
          const itens = atendimentos.filter((a) => a.etapa === etapa);
          return (
            <div key={etapa} className="flex min-w-[220px] flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {ROTULOS_ETAPA_ATENDIMENTO[etapa]} ({itens.length})
              </h2>
              <div className="flex flex-col gap-2">
                {itens.map((atendimento) => {
                  const ultima = atendimento.interacoes[atendimento.interacoes.length - 1];
                  return (
                    <Card key={atendimento.atendimentoId}>
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-sm font-medium">
                          <Link href={`/cadastros/${atendimento.cadastroId}`} className="hover:underline">
                            {nomePorCadastro.get(atendimento.cadastroId) ?? "Cadastro"}
                          </Link>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2 p-3 pt-2">
                        <p className="text-sm">{ultima.descricao}</p>
                        {atendimento.valorEstimado > 0 && (
                          <p className="text-xs text-muted-foreground">
                            R${" "}
                            {atendimento.valorEstimado.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        )}
                        {atendimento.interacoes.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            {atendimento.interacoes.length} registros neste atendimento
                          </p>
                        )}
                        <EtapaInteracaoSelect id={ultima.id} etapa={atendimento.etapa} />
                        <ReagendarInteracao
                          interacaoId={ultima.id}
                          cadastroId={atendimento.cadastroId}
                          dataReagendamento={ultima.dataReagendamento ?? ""}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
