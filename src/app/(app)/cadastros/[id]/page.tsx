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
import { formatarCodigo } from "@/lib/contador";
import { CORES_TIPO_CADASTRO, ROTULOS_ETAPA_ATENDIMENTO, ROTULOS_TIPO_INTERACAO } from "@/lib/rotulos";
import { listarAnexosPorCadastro } from "@/server/anexos";
import { buscarCadastro } from "@/server/cadastros";
import { listarInteracoesPorCadastro } from "@/server/crm";
import { listarRamosAtividade } from "@/server/ramos-atividade";
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

  const [interacoes, ramosAtividade, sugestoesEndereco, anexos] = await Promise.all([
    listarInteracoesPorCadastro(id),
    listarRamosAtividade(),
    listarSugestoesEndereco(),
    listarAnexosPorCadastro(id),
  ]);

  const anexosPorInteracao = new Map<string, typeof anexos>();
  for (const anexo of anexos) {
    const lista = anexosPorInteracao.get(anexo.interacaoId) ?? [];
    lista.push(anexo);
    anexosPorInteracao.set(anexo.interacaoId, lista);
  }

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
          <TabsTrigger value="interacoes">Interações ({interacoes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="pt-4">
          <CadastroForm
            cadastro={cadastro}
            ramosAtividade={ramosAtividade}
            sugestoesEndereco={sugestoesEndereco}
          />
        </TabsContent>

        <TabsContent value="interacoes" className="flex flex-col gap-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar interação</CardTitle>
            </CardHeader>
            <CardContent>
              <InteracaoForm cadastroId={cadastro.id} />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {interacoes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma interação registrada.</p>
            )}
            {interacoes.map((interacao) => (
              <div key={interacao.id}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">{ROTULOS_TIPO_INTERACAO[interacao.tipo]}</Badge>
                  <Badge>{ROTULOS_ETAPA_ATENDIMENTO[interacao.etapa]}</Badge>
                  <span className="text-muted-foreground">
                    Atendimento: {new Date(interacao.data).toLocaleDateString("pt-BR")}
                  </span>
                  {interacao.createdAt && (
                    <span className="text-xs text-muted-foreground">
                      (incluído em {new Date(interacao.createdAt).toLocaleDateString("pt-BR")}
                      {interacao.usuarioNome ? ` por ${interacao.usuarioNome}` : ""})
                    </span>
                  )}
                </div>
                {interacao.valorEstimado > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Valor estimado: R${" "}
                    {Number(interacao.valorEstimado).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                )}
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
                <Separator className="mt-3" />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
