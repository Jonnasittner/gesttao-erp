import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Os indicadores gerenciais (clientes, pedidos, financeiro) serão exibidos aqui na
          próxima fase, assim que os módulos de Pedidos e Financeiro estiverem prontos.
        </CardContent>
      </Card>
    </div>
  );
}
