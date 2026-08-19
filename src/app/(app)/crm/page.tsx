import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EtapaInteracaoSelect } from "@/components/crm/etapa-interacao-select";
import { listarCadastros } from "@/server/cadastros";
import { listarInteracoes } from "@/server/crm";
import { ETAPA_ATENDIMENTO } from "@/lib/types";
import { ROTULOS_ETAPA_ATENDIMENTO } from "@/lib/rotulos";

export default async function CrmPage() {
  const [interacoes, cadastros] = await Promise.all([listarInteracoes(), listarCadastros()]);
  const nomePorCadastro = new Map(cadastros.map((c) => [c.id, c.nome]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">CRM — Funil de atendimentos</h1>

      <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {ETAPA_ATENDIMENTO.map((etapa) => {
          const itens = interacoes.filter((i) => i.etapa === etapa);
          return (
            <div key={etapa} className="flex min-w-[220px] flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {ROTULOS_ETAPA_ATENDIMENTO[etapa]} ({itens.length})
              </h2>
              <div className="flex flex-col gap-2">
                {itens.map((interacao) => (
                  <Card key={interacao.id}>
                    <CardHeader className="p-3 pb-0">
                      <CardTitle className="text-sm font-medium">
                        <Link href={`/cadastros/${interacao.cadastroId}`} className="hover:underline">
                          {nomePorCadastro.get(interacao.cadastroId) ?? "Cadastro"}
                        </Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2 p-3 pt-2">
                      <p className="text-sm">{interacao.descricao}</p>
                      {interacao.valorEstimado > 0 && (
                        <p className="text-xs text-muted-foreground">
                          R${" "}
                          {Number(interacao.valorEstimado).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      )}
                      <EtapaInteracaoSelect id={interacao.id} etapa={interacao.etapa} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
