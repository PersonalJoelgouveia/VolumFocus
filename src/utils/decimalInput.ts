/**
 * Utilitários para campos de peso/carga que aceitam decimais com ponto OU vírgula
 * (ex.: "12.5", "12,5", "20,75"), independente do teclado/locale do aparelho.
 *
 * Por que não `type="number"`: em pt-BR cada navegador trata a vírgula de um jeito
 * e estados intermediários como "12," viram value "" — num input controlado isso
 * zera o campo enquanto o aluno digita. Usamos `type="text" inputMode="decimal"`
 * (teclado numérico com separador decimal) e convertemos nós mesmos.
 */

/**
 * Mantém só dígitos e UM separador decimal (o que o usuário digitou: "." ou ",").
 * Não adiciona nem troca o separador — preserva "12," enquanto a pessoa ainda digita.
 */
export function sanitizeDecimalInput(raw: string, maxDecimals = 2): string {
  let out = '';
  let sep = false;
  let decimals = 0;
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') {
      if (sep) {
        if (decimals >= maxDecimals) continue;
        decimals++;
      }
      out += ch;
    } else if ((ch === '.' || ch === ',') && !sep) {
      sep = true;
      out += ch;
    }
  }
  return out;
}

/**
 * Converte texto digitado em número. Aceita vírgula ou ponto como decimal.
 * Retorna `undefined` para vazio/inválido (nunca NaN).
 */
export function parseDecimal(raw: string | number | null | undefined): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const s = raw.trim().replace(',', '.');
  if (s === '' || s === '.') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Número → texto para o campo, sem zeros à direita ("12.5", "20.75", "10"). */
export function decimalToInputText(n: number | undefined): string {
  return n === undefined || !Number.isFinite(n) ? '' : String(n);
}
