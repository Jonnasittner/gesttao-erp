export function formatarCodigo(numero: number): string {
  return String(numero).padStart(4, "0");
}
