import { describe, expect, it } from 'vitest';
import type { ExDoneMap, StrengthLogEntry, WorkoutDayLog } from '../../types/workout';
import { findCursor, isEntryComplete, isRoundComplete, withSetDone } from '../notepadProgress';

function e(exId: string, over: Partial<StrengthLogEntry> = {}): StrengthLogEntry {
  return { exId, sets: 3, reps: 10, load: 50, serieLoads: [50, 50, 50], serieReps: [10, 10, 10], ...over };
}

const none: ExDoneMap = {};
const complete = (log: WorkoutDayLog, exDone: ExDoneMap = none) => (i: number) => isEntryComplete(log[i], i, 0, exDone);

describe('findCursor', () => {
  it('começa na primeira série do primeiro exercício', () => {
    const log = [e('a'), e('b')];
    expect(findCursor(log, complete(log))).toEqual({ idx: 0, set: 0 });
  });

  it('avança para a primeira série em aberto', () => {
    const log = [e('a', { doneSerie: [true, true, false] }), e('b')];
    expect(findCursor(log, complete(log))).toEqual({ idx: 0, set: 2 });
  });

  it('pula exercício concluído (todas as séries ou exDone) e devolve null ao final', () => {
    const log = [e('a', { doneSerie: [true, true, true] }), e('b')];
    expect(findCursor(log, complete(log))).toEqual({ idx: 1, set: 0 });
    const done: ExDoneMap = { '0:1': true };
    expect(findCursor(log, complete(log, done))).toBeNull();
  });

  it('conjugado alterna A1, B1, A2, B2…', () => {
    const g = { groupId: 'G', groupType: 'biset' as const };
    let log: WorkoutDayLog = [e('a', g), e('b', g), e('c')];
    const order: string[] = [];
    for (let k = 0; k < 6; k++) {
      const cur = findCursor(log, complete(log))!;
      const entry = log[cur.idx] as StrengthLogEntry;
      order.push(`${entry.exId}${cur.set + 1}`);
      log = log.map((x, i) => (i === cur.idx ? { ...entry, doneSerie: withSetDone(entry, cur.set) } : x));
    }
    expect(order).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3']);
    expect(findCursor(log, complete(log))).toEqual({ idx: 2, set: 0 });
  });
});

describe('isRoundComplete', () => {
  const g = { groupId: 'G', groupType: 'biset' as const };

  it('fora de conjugado sempre descansa', () => {
    const log = [e('a')];
    expect(isRoundComplete(log, { idx: 0, set: 0 }, complete(log))).toBe(true);
  });

  it('em conjugado só descansa depois do último membro da rodada', () => {
    let log: WorkoutDayLog = [e('a', g), e('b', g)];
    // A1 feito: B ainda não fez a série 1 → sem descanso
    log = [{ ...(log[0] as StrengthLogEntry), doneSerie: [true, false, false] }, log[1]];
    expect(isRoundComplete(log, { idx: 0, set: 0 }, complete(log))).toBe(false);
    // B1 feito: rodada completa → descansa
    log = [log[0], { ...(log[1] as StrengthLogEntry), doneSerie: [true, false, false] }];
    expect(isRoundComplete(log, { idx: 1, set: 0 }, complete(log))).toBe(true);
  });
});
