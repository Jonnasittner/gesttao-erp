import { notFound } from "next/navigation";
import { CadastroForm } from "@/components/cadastros/cadastro-form";
import { AnexosInteracao } from "@/components/crm/anexos-interacao";
import { EditarInteracao } from "@/components/crm/editar-interacao";
import { InteracaoForm } from "@/components/crm/interacao-form";
import { ReagendarInteracao } from "@/components/crm/reagendar-interacao";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatarCodigo } from "@/lib/codigo";
import { CORES_TIPO_CADASTRO, ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { formatarDataHora } from "@/lib/datetime";
import { ETAPAS_FECHADAS } from "@/lib/types";
import { listarAnexosPorCadastro } from "@/server/anexos";
import { buscarCadastro } from "@/server/cadastros";
import { listarAtendimentosPorCadastro } from "@/server/crm";
import { listarSugestoesEndereco } from "@/server/enderecos";

const ROTULOS_TIPO_CADASTRO: Record<string, string> = {
  CLIENTE: "Cliente",
  FORNECEDOR: "Fornecedor",
  INTERNO: "Interno",
};

export default async function CadastroDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cadastro = await buscarCadastro(id);
  if (!cadastro) notFound();

  const [atendimentos, sugestoesEndereco, anexos] = await Promise.all([
    listarAtendimentosPorCadastro(id),
    listarSugestoesEndereco(),
    listarAnexosPorCadastro(id),
  ]);

  const anexosPorInteracao = new Map<string, typeof anexos>();
  for (const anexo of anexos) {
    const lista = anexosPorInteracao.get(anexo.interacaoId) ?? [];
    lista.push(anexo);
    anexosPorInteracao.set(anexo.interacaoId, lista);
  }

  const totalInteracoes = atendimentos.reduce((n, a) => n + a.interacoes.length, 0);
  const atendimentoAberto = atendimentos[0] && !ETAPAS_FECHADAS.includes(atendimentos[0].etapa)
    ? atendimentos[0]
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{cadastro.nome}</h1>
        <Badge variant="outline" className="font-mono">
          {formatarCodigo(cadastro.codigo)}
        </Badge>
        {cadastro.tipos.map((tipo) => (
          <Badge key={tipo} variant="outline" className={CORES_TIPO_CADASTRO[tipo]}>
            {ROTULOS_TIPO_CADASTRO[tipo]}
          </Badge>
        ))}
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="interacoes">Interações ({totalInteracoes})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="pt-4">
          <CadastroForm cadastro={cadastro} sugestoesEndereco={sugestoesEndereco} />
        </TabsContent>

        <TabsContent value="interacoes" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {atendimentoAberto ? "Continuar atendimento" : "Registrar interação"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InteracaoForm
                cadastroId={cadastro.id}
                etapaAtual={atendimentoAberto?.etapa}
                valorEstimadoAtual={atendimentoAberto?.valorEstimado}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {atendimentos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>
            )}
            {atendimentos.map((atendimento) => (
              <Card key={atendimento.atendimentoId}>
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                  <Badge>{ROTULOS_ETAPA_ATENDIMENTO[atendimento.etapa]}</Badge>
                  {atendimento.valorEstimado > 0 && (
                    <span className="text-sm text-muted-foreground">
                      R${" "}
                      {atendimento.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {atendimento.interacoes.length}{" "}
                    {atendimento.interacoes.length === 1 ? "registro" : "registros"} · desde{" "}
                    {formatarDataHora(atendimento.primeiraData)}
                  </span>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {atendimento.interacoes.map((interacao, indice) => (
                    <div key={interacao.id}>
                      {indice > 0 && <Separator className="mb-4" />}
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary">{ROTULOS_TIPO_INTERACAO[interacao.tipo]}</Badge>
                        <Badge variant="outline">{ROTULOS_ETAPA_ATENDIMENTO[interacao.etapa]}</Badge>
                        <span className="text-muted-foreground">
                          Atendimento: {formatarDataHora(interacao.data)}
                        </span>
                        {interacao.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            (incluído em {new Date(interacao.createdAt).toLocaleDateString("pt-BR")}
                            {interacao.usuarioNome ? ` por ${interacao.usuarioNome}` : ""})
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm">{interacao.descricao}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <ReagendarInteracao
                          interacaoId={interacao.id}
                          cadastroId={cadastro.id}
                          dataReagendamento={interacao.dataReagendamento ?? ""}
                        />
                        <EditarInteracao interacao={interacao} cadastroId={cadastro.id} />
                      </div>
                      <div className="mt-2">
                        <AnexosInteracao
                          interacaoId={interacao.id}
                          cadastroId={cadastro.id}
                          anexos={anexosPorInteracao.get(interacao.id) ?? []}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
