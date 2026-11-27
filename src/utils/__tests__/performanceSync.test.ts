import { describe, expect, it } from 'vitest';
import { assinaturaSemana, montarSemanas, semanaVazia, validarSemanaRemota } from '../performanceSync';

const exs = [
  { id: 'e1', name: 'Supino', agonist: 'Peito', synergist: ['Tríceps'], stabilizer: [], imgInicio: 'data:image/png;base64,AAAA' },
  { id: 'c1', name: 'Esteira', agonist: 'Cardio', type: 'cardio', synergist: [], stabilizer: [] },
  { id: 'x9', name: 'Nao usado', agonist: 'Costas', synergist: [], stabilizer: [] },
] as never;
const f = { exId: 'e1', sets: 3, reps: 10, load: 50, serieLoads: [50, 50, 50], serieReps: [10, 10, 10] };
const c = { exId: 'c1', type: 'cardio', duration: 20, intensity: 5, hrZone: 'z2' };
const NOW = new Date(2026, 10, 26, 10); // qui 26/11/2026 → semana atual = 2026-11-23

describe('montarSemanas', () => {
  const base = { weekLog: {}, weekPSE: {}, exDone: {}, retro: {}, historico: [], exercises: exs, now: NOW };

  it('semana atual, retroativa e arquivada viram documentos por segunda-feira, só os exercícios usados e sem imagens', () => {
    const r = montarSemanas({
      ...base,
      weekLog: { 2: [f, c] } as never,
      exDone: { '2:0': true } as never,
      retro: { '2026-11-16': { weekLog: { 0: [f] }, weekPSE: { 0: 6 }, exDone: {} } } as never,
      historico: [{ data: '2026-11-11T12:00:00Z', weekLog: { 1: [c] }, weekPSE: {} }] as never, // qua 11/11 → semana 09/11
    });
    expect(Object.keys(r).sort()).toEqual(['2026-11-09', '2026-11-16', '2026-11-23']);
    expect(r['2026-11-23'].origem).toBe('atual');
    expect(r['2026-11-23'].exDone).toEqual({ '2:0': true });
    expect(r['2026-11-16'].origem).toBe('retro');
    expect(r['2026-11-09'].origem).toBe('historico');
    expect(r['2026-11-09'].exDone).toBeUndefined();
    expect(r['2026-11-23'].exercicios.map((x) => x.id).sort()).toEqual(['c1', 'e1']);
    expect(JSON.stringify(r)).not.toContain('base64');
    expect(JSON.stringify(r)).not.toContain('undefined');
  });

  it('prioridade igual à do grid: atual > retroativa > arquivada na mesma semana', () => {
    const r = montarSemanas({
      ...base,
      weekLog: { 0: [f] } as never,
      retro: { '2026-11-23': { weekLog: { 0: [c] }, weekPSE: {}, exDone: {} } } as never,
      historico: [{ data: '2026-11-24T12:00:00Z', weekLog: { 0: [c] }, weekPSE: {} }] as never,
    });
    expect(r['2026-11-23'].origem).toBe('atual');
  });

  it('semana sem treino não gera documento', () => {
    expect(montarSemanas({ ...base, weekLog: { 0: [] } as never })).toEqual({});
  });
});

describe('assinatura e semana vazia', () => {
  it('assinatura ignora o carimbo de hora e muda com o conteúdo', () => {
    const a = montarSemanas({ weekLog: { 0: [f] } as never, weekPSE: {}, exDone: {}, retro: {}, historico: [], exercises: exs, now: NOW })['2026-11-23'];
    const b = { ...a, atualizadoEm: 'outro' };
    expect(assinaturaSemana(a)).toBe(assinaturaSemana(b));
    expect(assinaturaSemana(a)).not.toBe(assinaturaSemana({ ...a, weekLog: { 0: [c] } as never }));
  });
  it('semana vazia não apaga: publica documento vazio válido', () => {
    const v = semanaVazia('2026-11-16', NOW);
    expect(v.weekLog).toEqual({});
    expect(validarSemanaRemota(v, '2026-11-16')).not.toBeNull();
  });
});

describe('validarSemanaRemota', () => {
  const ok = { semana: '2026-11-16', origem: 'retro', weekLog: { 0: [f] }, weekPSE: { 0: 6 }, exDone: { '0:0': true }, exercicios: [{ id: 'e1', name: 'Supino', agonist: 'Peito', synergist: [], stabilizer: [] }], atualizadoEm: 'x' };
  it('aceita válido e rejeita malformado', () => {
    expect(validarSemanaRemota(ok, '2026-11-16')?.weekLog[0]).toHaveLength(1);
    expect(validarSemanaRemota(ok, '2026-11-23')).toBeNull(); // id diferente
    expect(validarSemanaRemota({ ...ok, origem: 'x' }, '2026-11-16')).toBeNull();
    expect(validarSemanaRemota({ ...ok, weekLog: { 9: [] } }, '2026-11-16')).toBeNull(); // dia fora de 0..6
    expect(validarSemanaRemota({ ...ok, weekLog: { 0: [{ foo: 1 }] } }, '2026-11-16')).toBeNull(); // entrada sem exId
    expect(validarSemanaRemota({ ...ok, weekLog: [] }, '2026-11-16')).toBeNull();
    expect(validarSemanaRemota({ ...ok, exercicios: [1] }, '2026-11-16')).toBeNull();
    expect(validarSemanaRemota(null, '2026-11-16')).toBeNull();
  });
});
