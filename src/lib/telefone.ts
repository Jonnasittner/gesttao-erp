export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);

  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    // fixo: (99) 9999-9999
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  // celular: (99) 9 9999-9999
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 3)} ${digitos.slice(3, 7)}-${digitos.slice(7)}`;
}
