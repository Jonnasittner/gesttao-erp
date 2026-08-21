function paraLocalISOSemZ(data: Date): string {
  const offsetMs = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - offsetMs).toISOString().slice(0, 16);
}

/** Data/hora atual no formato aceito por <input type="datetime-local">. */
export function agoraDatetimeLocal(): string {
  return paraLocalISOSemZ(new Date());
}

/** Converte um ISO salvo no banco para o formato de <input type="datetime-local">. */
export function paraDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return paraLocalISOSemZ(data);
}

/** Formata um ISO de data/hora completo para exibição (DD/MM/AAAA HH:mm). */
export function formatarDataHora(iso: string): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Data de hoje + N meses, no formato "AAAA-MM-DD" (para preenchimento rápido de reagendamento). */
export function dataMaisMeses(meses: number): string {
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + meses, hoje.getDate());
  const ano = alvo.getFullYear();
  const mes = String(alvo.getMonth() + 1).padStart(2, "0");
  const dia = String(alvo.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Um valor "YYYY-MM-DDTHH:mm" tem horário; "YYYY-MM-DD" sozinho é dia inteiro. */
export function temHorario(valor: string): boolean {
  return valor.includes("T");
}

/** Formata data ou data+hora de reagendamento, sem sofrer troca de dia por fuso horário. */
export function formatarReagendamento(valor: string): string {
  if (!valor) return "";
  if (temHorario(valor)) return formatarDataHora(valor);

  const [ano, mes, dia] = valor.split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano} (dia inteiro)`;
}
