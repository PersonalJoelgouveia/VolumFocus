import { describe, expect, it } from 'vitest';
import { classificarTendencia, montarSeriesCardio, montarSeriesForca, parseDataPtBr } from '../testesComparativo';
import type { CardioTestResult } from '../../types/cardioTest';

const cardio = (id: string, data: string, vo2: number, protocol: 'bruce' | 'astrand', modality: 'esteira' | 'bike' = 'esteira') =>
  ({ id, data, vo2, inputs: { modality, protocol }, classification: { label: 'Bom' } }) as unknown as CardioTestResult;

describe('classificarTendencia', () => {
  it('melhora, manutenção e regressão', () => {
    expect(classificarTendencia(40, 44).tendencia).toBe('melhora');
    expect(classificarTendencia(40, 40.3).tendencia).toBe('manutencao');
    expect(classificarTendencia(40, 36).tendencia).toBe('regressao');
  });
});

describe('séries', () => {
  it('cardio: protocolos diferentes ficam em séries separadas e ordenadas por data', () => {
    const s = montarSeriesCardio([
      cardio('a', '2026-02-01T10:00:00Z', 42, 'bruce'),
      cardio('b', '2026-01-01T10:00:00Z', 40, 'bruce'),
      cardio('c', '2026-01-15T10:00:00Z', 50, 'astrand'),
    ]);
    expect(s).toHaveLength(2);
    expect(s[0].pontos.map((p) => p.id)).toEqual(['b', 'a']);
    expect(s[1].pontos).toHaveLength(1);
  });
  it('força: recorde legado vira ponto-base sem duplicar o histórico', () => {
    const rec = { Supino: { weight: 80, reps: 5, rir: 0, oneRM: 93, formula: 'hibrida' as const, date: '10/01/2026' } };
    expect(montarSeriesForca([], rec)[0].pontos).toHaveLength(1);
    const hist = [{ exercise: 'Supino', weight: 80, reps: 5, oneRM: 93, formula: 'hibrida' as const, data: '2026-02-01T00:00:00Z' }];
    expect(montarSeriesForca(hist, rec)[0].pontos).toHaveLength(1);
  });
  it('parseDataPtBr', () => {
    expect(new Date(parseDataPtBr('10/01/2026')).getMonth()).toBe(0);
  });
});
