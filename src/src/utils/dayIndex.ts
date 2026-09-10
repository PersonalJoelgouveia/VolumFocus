/** Índice de hoje na convenção do app (0=Segunda...6=Domingo). `Date.getDay()` usa 0=Domingo, por isso o deslocamento. */
export function getTodayDayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}
