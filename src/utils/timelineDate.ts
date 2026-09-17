const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

/** Formata pro padrão do timeline de Avaliação Física: "11 SET 2026". */
export function formatarDataCurta(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dia = String(d.getDate()).padStart(2, '0');
  return `${dia} ${MESES_ABREV[d.getMonth()]} ${d.getFullYear()}`;
}

function paraYYYYMMDD(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** 'YYYY-MM-DD' de hoje, no fuso local — valor inicial de `<input type="date">`
 *  nos formulários de avaliação (Dobras/Bioimpedância/Online). */
export function hojeISODate(): string {
  return paraYYYYMMDD(new Date());
}

/** Converte a data já armazenada numa avaliação (ISO completo ou `Date`)
 *  pro formato que `<input type="date">` espera — usado ao abrir uma
 *  avaliação existente pra edição. */
export function paraDateInputValue(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return paraYYYYMMDD(d);
}

/** Converte o valor de `<input type="date">` ('YYYY-MM-DD') pra ISO
 *  completo, fixando meio-dia local — evita a data "pular" um dia por
 *  causa de fuso horário quando só o dia (sem hora) importa pro usuário. */
export function dateInputParaISO(valor: string): string {
  return new Date(`${valor}T12:00:00`).toISOString();
}
