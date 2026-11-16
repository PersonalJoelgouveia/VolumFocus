import { describe, expect, it } from 'vitest';
import { cargaAlvoDoTeste, cargaParaReps, estimarPesoIdeal, formatarCarga } from '../cargaAlvo';
import { strCalcAll } from '../strengthCalc';

describe('cargaAlvo', () => {
  it('formata XX,XX kg', () => {
    expect(formatarCarga(62.5)).toBe('62,50 kg');
  });
  it('inverte a fórmula: carga calculada reproduz o 1RM', () => {
    for (const f of ['epley', 'brzycki', 'lombardi', 'hibrida'] as const) {
      const w = cargaParaReps(100, 8, f)!;
      expect(strCalcAll(w, 8)[f]!).toBeGreaterThan(99.5);
      expect(strCalcAll(w, 8)[f]!).toBeLessThan(100.5);
    }
  });
  it('1 rep = 1RM', () => {
    expect(cargaParaReps(100, 1, 'epley')).toBeGreaterThan(96);
  });
  it('sem teste → null; com teste usa a fórmula do recorde', () => {
    expect(cargaAlvoDoTeste(undefined, 10)).toBeNull();
    const r = cargaAlvoDoTeste({ weight: 80, reps: 5, rir: 0, oneRM: 93, formula: 'epley', date: '01/01/2026' }, 10)!;
    expect(r.formula).toBe('epley');
    expect(r.carga).toBeCloseTo(93 / (1 + 10 / 30), 1);
  });
  it('estimativa rejeita entradas inválidas', () => {
    expect(estimarPesoIdeal(0, 5, 10)).toBeNull();
    expect(estimarPesoIdeal(60, 10, 10)!.carga).toBeGreaterThan(0);
  });
});
