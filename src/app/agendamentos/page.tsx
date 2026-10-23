import { listarCadastros } from "@/server/cadastros";
import { buscarStatusGoogleCalendar } from "@/server/google-calendar";
import { AgendamentosClient } from "@/components/agendamentos/agendamentos-client";

export default async function AgendamentosPage() {
  const [cadastros, googleCalendar] = await Promise.all([
    listarCadastros(),
    buscarStatusGoogleCalendar(),
  ]);

  return <AgendamentosClient cadastros={cadastros} emailGoogle={googleCalendar.email} />;
}
