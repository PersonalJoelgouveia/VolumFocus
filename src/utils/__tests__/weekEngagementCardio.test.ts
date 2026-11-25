import { describe, expect, it } from 'vitest';
import { getCardioWeekSummary } from '../weekEngagement';

const ex = [{ id: 'e1', name: 'Esteira' }] as never;
const c = (d: number) => ({ exId: 'e1', type: 'cardio', duration: d, intensity: 5, hrZone: 'z2' });

describe('getCardioWeekSummary com exDone', () => {
  const log = { 0: [c(30), c(20)], 2: [c(15)] } as never;
  it('sem exDone mantém o comportamento antigo (conta tudo)', () => {
    expect(getCardioWeekSummary(log, ex).totalMin).toBe(65);
  });
  it('com exDone só conta o cardio concluído', () => {
    const r = getCardioWeekSummary(log, ex, { '0:1': true, '2:0': true } as never);
    expect(r.totalMin).toBe(35);
    expect(r.maior?.duration).toBe(20);
    expect(getCardioWeekSummary(log, ex, {} as never).totalMin).toBe(0);
  });
});
