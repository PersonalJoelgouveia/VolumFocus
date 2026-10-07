import { describe, it, expect } from 'vitest';
import { aplicarCargasNaRotina, aplicarCargasNoWeekLog, chaveExercicio, normalizarMapaCargas } from '../cargasCompartilhadas';
import type { MapaCargas } from '../cargasCompartilhadas';
import type { Exercise } from '../../types/exercise';
import type { StrengthLogEntry, WeekLog } from '../../types/workout';
import { criarRotinaVazia } from '../../types/aluno';

const banco = [{ id: 'e1', name: 'Supino Reto' }, { id: 'e2', name: 'Remada' }] as Exercise[];
const forca = (exId: string, load: number, extra: Partial<StrengthLogEntry> = {}): StrengthLogEntry => ({
  exId, sets: 3, reps: 10, load, serieLoads: [load, load, load], serieReps: [10, 10, 10], ...extra,
});
const mapa = (por: 'aluno' | 'personal', carga: number, nome = 'Supino Reto'): MapaCargas => ({
  [chaveExercicio(nome)]: { carga, em: '2026-10-07T12:00:00.000Z', por },
});

describe('chaveExercicio / normalizarMapaCargas', () => {
  it('ignora acento, caixa e pontuação', () => {
    expect(chaveExercicio('Supino Reto (Barra)')).toBe('supino_reto_barra');
    expect(chaveExercicio('Elevação Pélvica')).toBe('elevacao_pelvica');
  });
  it('descarta entradas malformadas', () => {
    const r = normalizarMapaCargas({ a: { carga: 10, em: 'x', por: 'aluno' }, b: { carga: -1, em: 'x', por: 'aluno' }, c: { carga: 5, em: 'x', por: 'hacker' }, d: 3 });
    expect(Object.keys(r)).toEqual(['a']);
  });
});

describe('aplicarCargasNoWeekLog', () => {
  it('aplica a carga do outro lado em todas as séries quando eram uniformes', () => {
    const wl: WeekLog = { 0: [forca('e1', 40)] };
    const r = aplicarCargasNoWeekLog(wl, banco, {}, mapa('aluno', 45), 'personal');
    const e = r.weekLog[0][0] as StrengthLogEntry;
    expect(r.alterados).toBe(1);
    expect(e.serieLoads).toEqual([45, 45, 45]);
    expect(e.load).toBe(45);
  });
  it('não aplica o que EU mesmo gravei, nem em exercício concluído, nem chave pendente', () => {
    const wl: WeekLog = { 0: [forca('e1', 40)] };
    expect(aplicarCargasNoWeekLog(wl, banco, {}, mapa('personal', 45), 'personal').weekLog).toBe(wl);
    expect(aplicarCargasNoWeekLog(wl, banco, { '0:0': true }, mapa('aluno', 45), 'personal').weekLog).toBe(wl);
    expect(aplicarCargasNoWeekLog(wl, banco, {}, mapa('aluno', 45), 'personal', new Set([chaveExercicio('Supino Reto')])).weekLog).toBe(wl);
  });
  it('preserva séries já feitas', () => {
    const wl: WeekLog = { 0: [forca('e1', 40, { doneSerie: [true, false, false] })] };
    const e = aplicarCargasNoWeekLog(wl, banco, {}, mapa('aluno', 50), 'personal').weekLog[0][0] as StrengthLogEntry;
    expect(e.serieLoads).toEqual([40, 50, 50]);
    expect(e.load).toBe(40);
  });
  it('pirâmide: muda só a 1ª série não feita', () => {
    const wl: WeekLog = { 0: [{ ...forca('e1', 40), serieLoads: [40, 50, 60] }] };
    const e = aplicarCargasNoWeekLog(wl, banco, {}, mapa('aluno', 42), 'personal').weekLog[0][0] as StrengthLogEntry;
    expect(e.serieLoads).toEqual([42, 50, 60]);
  });
  it('mesma carga = sem mudança (mesma referência)', () => {
    const wl: WeekLog = { 0: [forca('e1', 45)] };
    expect(aplicarCargasNoWeekLog(wl, banco, {}, mapa('aluno', 45), 'personal').weekLog).toBe(wl);
  });
});

describe('aplicarCargasNaRotina', () => {
  it('atualiza só a carga da prescrição pelo nome', () => {
    const r = criarRotinaVazia();
    r[1] = { tipo: 'Peito', exercicios: [{ nome: 'Supino Reto', series: 3, reps: '10', carga: 40 }] };
    const out = aplicarCargasNaRotina(r, mapa('aluno', 47.5), 'personal');
    expect(out.diasAlterados).toEqual([1]);
    expect((out.rotina[1].exercicios[0] as { carga: number }).carga).toBe(47.5);
    expect(aplicarCargasNaRotina(r, mapa('personal', 47.5), 'personal').rotina).toBe(r);
  });
});
