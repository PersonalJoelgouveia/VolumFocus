import type { WorkoutDayLog, WorkoutLogEntry } from '../types/workout';

export interface FreeRow {
  kind: 'free';
  index: number;
  entry: WorkoutLogEntry;
}

export interface GroupRow {
  kind: 'group';
  groupId: string;
  members: { index: number; entry: WorkoutLogEntry }[];
}

export type DayLogRow = FreeRow | GroupRow;

/**
 * Migrado do laço `log.forEach((entry,i)=>{...})` em renderDayContent()
 * (index.html ~4610-4637): agrupa entradas que compartilham `groupId` num
 * único bloco visual, renderizado na posição do primeiro membro do grupo
 * — mesmo quando os índices não são contíguos no array.
 */
export function buildDayLogRows(dayLog: WorkoutDayLog): DayLogRow[] {
  const rows: DayLogRow[] = [];
  const seen = new Set<number>();

  dayLog.forEach((entry, i) => {
    if (seen.has(i)) return;

    if (entry.groupId) {
      const groupId = entry.groupId;
      const memberIndices: number[] = [];
      dayLog.forEach((e2, j) => {
        if (e2.groupId === groupId) memberIndices.push(j);
      });

      if (memberIndices[0] !== i) {
        seen.add(i);
        return;
      }
      memberIndices.forEach((j) => seen.add(j));

      rows.push({
        kind: 'group',
        groupId,
        members: memberIndices.map((j) => ({ index: j, entry: dayLog[j] })),
      });
    } else {
      seen.add(i);
      rows.push({ kind: 'free', index: i, entry });
    }
  });

  return rows;
}
