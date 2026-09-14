import { redirect } from "next/navigation";

// A tela inicial do sistema é a agenda; o dashboard fica em /dashboard.
export default function Home() {
  redirect("/agendamentos");
}
