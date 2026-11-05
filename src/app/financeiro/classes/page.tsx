import { PageHeader } from "@/components/ui/page-header";
import { ClassesDespesaEditor } from "@/components/financeiro/classes-despesa-editor";
import { listarClassesDespesa } from "@/server/classes-despesa";

export default async function ClassesDespesaPage() {
  const classes = await listarClassesDespesa();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader
        titulo="Classes de despesa"
        voltar={{ href: "/financeiro?tipo=PAGAR", label: "Contas a pagar" }}
      />
      <ClassesDespesaEditor classes={classes} />
    </div>
  );
}
