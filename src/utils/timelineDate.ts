const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Formata pro padrão do timeline de Avaliação Física: "11 SET 2026". */
export function formatarDataCurta(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dia = String(d.getDate()).padStart(2, '0');
  return `${dia} ${MESES_ABREV[d.getMonth()]} ${d.getFullYear()}`;
}
