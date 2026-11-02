import { PageHeader } from "@/components/ui/page-header";
import { ClassesDespesaEditor } from "@/components/financeiro/classes-despesa-editor";
import { listarClassesDespesa } from "@/server/classes-despesa";

export default async function ClassesDespesaPage() {
  const classes = await listarClassesDespesa();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader
        titulo="Classes de despesa"
        descricao="O plano de contas das contas a pagar. Toda conta a pagar tem uma classe e uma subclasse. Classe ou subclasse já usada em lançamento não pode ser excluída, só inativada."
        voltar={{ href: "/financeiro?tipo=PAGAR", label: "Contas a pagar" }}
      />
      <ClassesDespesaEditor classes={classes} />
    </div>
  );
}
