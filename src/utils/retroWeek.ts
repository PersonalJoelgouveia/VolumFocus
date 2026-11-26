/** Utilitários de semana (segunda a domingo, data local) para lançamentos retroativos. */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Segunda-feira (00:00 local) da semana de `d`. */
export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function parseWeekKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Semana (chave = segunda-feira) e dia do app (0=Seg…6=Dom) de uma data. */
export function weekAndDayOf(d: Date): { key: string; day: number } {
  const mon = mondayOf(d);
  const day = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - mon.getTime()) / 86_400_000);
  return { key: dateKey(mon), day };
}

export function isCurrentWeek(key: string, now: Date = new Date()): boolean {
  return key === dateKey(mondayOf(now));
}

/** Soma `n` semanas (pode ser negativo) à chave de uma semana. */
export function shiftWeek(key: string, n: number): string {
  const d = parseWeekKey(key);
  d.setDate(d.getDate() + 7 * n);
  return dateKey(d);
}

export function formatWeekRange(key: string): string {
  const a = parseWeekKey(key);
  const b = parseWeekKey(shiftWeek(key, 0));
  b.setDate(b.getDate() + 6);
  const f = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  return `${f(a)} – ${f(b)}/${b.getFullYear()}`;
}

/** Retroativo só até a semana ATUAL (futuro bloqueado): `key` não pode passar da segunda-feira de hoje. */
export function weekAllowed(key: string, now: Date = new Date()): boolean {
  return key <= dateKey(mondayOf(now));
}
