import { describe, expect, it } from 'vitest';
import { buildCgridData } from '../consistencyGrid';

const exs = [
  { id: 'f1', name: 'Supino', type: 'forca' },
  { id: 'c1', name: 'Esteira', type: 'cardio' },
] as never;
const f = { exId: 'f1', sets: 3, reps: 10, load: 50 };
const c = { exId: 'c1', type: 'cardio', duration: 20, intensity: 5, hrZone: 'z2' };
const NOW = new Date(2026, 10, 26); // qui 26/11/2026

describe('consistencyGrid — retroativos e meses', () => {
  const retro = { '2026-11-09': { weekLog: { 0: [f], 2: [c], 4: [f, c] }, weekPSE: {}, exDone: {} } } as never;

  it('semana retroativa entra no calendário na data real (seg 09, qua 11, sex 13)', () => {
    const d = buildCgridData({}, {}, [], exs, retro, 0, NOW);
    const st = (day: number) => d.cells[day - 1].state;
    expect(st(9)).toBe('cgrid-forca');
    expect(st(11)).toBe('cgrid-cardio');
    expect(st(13)).toBe('cgrid-ambos');
    expect(st(10)).toBe('cgrid-vazio');
    expect(d.cells[8].date).toBe('2026-11-09');
  });

  it('semana atual tem prioridade sobre a retroativa do mesmo dia', () => {
    const retroAtual = { '2026-11-23': { weekLog: { 0: [f] }, weekPSE: {}, exDone: {} } } as never;
    const d = buildCgridData({ 0: [c] } as never, { '0:0': true } as never, [], exs, retroAtual, 0, NOW);
    expect(d.cells[22].state).toBe('cgrid-cardio'); // 23/11 = semana atual (cardio), não o força retroativo
  });

  it('mês anterior: sem "hoje"/futuro e retroativos que cruzam o mês', () => {
    const r = { '2026-10-26': { weekLog: { 5: [f], 6: [c] }, weekPSE: {}, exDone: {} } } as never; // sáb 31/10 e dom 01/11
    const out = buildCgridData({}, {}, [], exs, r, -1, NOW);
    expect(out.monthLabel).toBe('Out 2026');
    expect(out.cells.some((x) => x.isToday || x.isFuture)).toBe(false);
    expect(out.cells[30].state).toBe('cgrid-forca'); // 31/10
    const nov = buildCgridData({}, {}, [], exs, r, 0, NOW);
    expect(nov.cells[0].state).toBe('cgrid-cardio'); // 01/11 (domingo da mesma semana)
  });

  it('offset positivo é ignorado (nunca vai ao futuro)', () => {
    expect(buildCgridData({}, {}, [], exs, {}, 3, NOW).monthLabel).toBe('Nov 2026');
  });
});
