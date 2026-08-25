/** Migrado de _croPad(n)/_croFmt(sec) (index.html ~10013-10017). */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
