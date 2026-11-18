import { describe, expect, it } from 'vitest';
import { derivarCardio, derivarForca, unirHistoricoForca, unirRecordes, validarTesteRemoto } from '../testesDesempenho';
import type { TesteCardioDoc, TesteForcaDoc } from '../testesDesempenho';
import { parseDataPtBr } from '../testesComparativo';

const f = (id: string, data: string, oneRM: number, exercise = 'Supino'): TesteForcaDoc => ({ id, tipo: 'forca', data, exercise, weight: 80, reps: 5, rir: 0, oneRM, formula: 'hibrida', autorEmail: 'pt@x.com' });
const cardioDoc = (id: string, data: string, vo2: number): TesteCardioDoc => ({
  id, tipo: 'cardio', data, autorEmail: 'pt@x.com',
  resultado: { id, data, inputs: { gender: 'M', age: 30, weight: 70, fcRest: 60, modality: 'esteira', protocol: 'bruce' }, vo2, fcMax: 190, fcRest: 60, fcr: 130, classification: { key: 'bom', label: 'Bom', cls: 'x' }, zones: [], formulaUsed: 'x' },
});

describe('validarTesteRemoto', () => {
  it('aceita documentos válidos e usa o id do DOCUMENTO', () => {
    const r = validarTesteRemoto({ ...f('x', '2026-01-01T00:00:00Z', 93) }, 'doc-id');
    expect(r?.id).toBe('doc-id');
    expect(validarTesteRemoto(cardioDoc('c', '2026-01-01T00:00:00Z', 40), 'doc-c')?.id).toBe('doc-c');
  });
  it('rejeita malformados', () => {
    expect(validarTesteRemoto(null, 'a')).toBeNull();
    expect(validarTesteRemoto({ ...f('x', '2026-01-01T00:00:00Z', 93), oneRM: 'abc' }, 'a')).toBeNull();
    expect(validarTesteRemoto({ ...f('x', '2026-01-01T00:00:00Z', 93), reps: 0 }, 'a')).toBeNull();
    expect(validarTesteRemoto({ ...f('x', 'nao-data', 93) }, 'a')).toBeNull();
    expect(validarTesteRemoto({ tipo: 'outro', data: '2026-01-01T00:00:00Z' }, 'a')).toBeNull();
    const c = cardioDoc('c', '2026-01-01T00:00:00Z', 40);
    expect(validarTesteRemoto({ ...c, resultado: { ...c.resultado, vo2: 9999 } }, 'a')).toBeNull();
    expect(validarTesteRemoto({ ...c, resultado: { ...c.resultado, inputs: { modality: 'nado', protocol: 'x' } } }, 'a')).toBeNull();
  });
  it('fórmula desconhecida cai em híbrida', () => {
    expect((validarTesteRemoto({ ...f('x', '2026-01-01T00:00:00Z', 93), formula: 'zzz' }, 'a') as TesteForcaDoc).formula).toBe('hibrida');
  });
});

describe('derivações', () => {
  it('força: record = melhor 1RM por exercício; history cronológico', () => {
    const r = derivarForca([f('b', '2026-03-01T00:00:00Z', 99), f('a', '2026-01-01T00:00:00Z', 93), f('c', '2026-02-01T00:00:00Z', 90), f('d', '2026-02-01T00:00:00Z', 120, 'Agachamento')]);
    expect(r.records.Supino.oneRM).toBe(99);
    expect(r.records.Agachamento.oneRM).toBe(120);
    expect(r.history.map((h) => h.oneRM)).toEqual([93, 90, 120, 99]);
  });
  it('cardio: mais recente primeiro', () => {
    expect(derivarCardio([cardioDoc('a', '2026-01-01T00:00:00Z', 40), cardioDoc('b', '2026-02-01T00:00:00Z', 44)]).map((t) => t.id)).toEqual(['b', 'a']);
  });
  it('união: recorde mais recente vence; histórico sem duplicar', () => {
    const remoto = derivarForca([f('a', '2026-01-10T12:00:00Z', 93)]);
    const local = { Supino: { weight: 85, reps: 5, rir: 0, oneRM: 99, formula: 'hibrida' as const, date: '10/02/2026' } };
    expect(unirRecordes(remoto.records, local, parseDataPtBr).Supino.oneRM).toBe(99);
    expect(unirRecordes(local, remoto.records, parseDataPtBr).Supino.oneRM).toBe(99);
    expect(unirHistoricoForca(remoto.history, remoto.history)).toHaveLength(1);
  });
});
