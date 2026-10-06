import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../types/exercise';
import type { WeekLog } from '../../types/workout';
import { decidirSincronizacao, fingerprintSemana, semanaVazia, temProgresso } from '../rotinaSync';

const bancoEx: Exercise[] = [{ id: 'e1', name: 'Supino', agonist: 'Peito', synergist: [], stabilizer: [] }];
const semana = (extra: Record<string, unknown> = {}): WeekLog => ({
  0: [{ id: 'x', exId: 'e1', sets: 3, reps: 10, load: 40, serieLoads: [40, 40, 40], serieReps: [10, 10, 10], ...extra }],
});

describe('temProgresso', () => {
  it('prescrição pura não é progresso', () => expect(temProgresso(semana(), {}, {})).toBe(false));
  it('exercício concluído, PSE, série marcada e cardio medido são progresso', () => {
    expect(temProgresso(semana(), { '0:0': true }, {})).toBe(true);
    expect(temProgresso(semana(), {}, { 0: 7 })).toBe(true);
    expect(temProgresso(semana({ doneSerie: [true, false, false] }), {}, {})).toBe(true);
    expect(temProgresso(semana({ doneSerie: [false, false, false] }), {}, {})).toBe(false);
    const cardio: WeekLog = { 1: [{ exId: 'c', type: 'cardio', duration: 20, intensity: 5, hrZone: 3, distance: 3 }] };
    expect(temProgresso(cardio, {}, {})).toBe(true);
  });
});

describe('fingerprintSemana', () => {
  it('ignora ids e execução; muda quando o plano muda', () => {
    const base = fingerprintSemana(semana(), bancoEx);
    expect(fingerprintSemana(semana({ id: 'outro', doneSerie: [true, true, true], serieLoads: [50, 50, 50] }), bancoEx)).toBe(base);
    expect(fingerprintSemana(semana({ sets: 4 }), bancoEx)).not.toBe(base);
    expect(fingerprintSemana(semana({ load: 60 }), bancoEx)).not.toBe(base);
  });
});

describe('decidirSincronizacao', () => {
  const fp = fingerprintSemana(semana(), bancoEx);
  const base = { exDone: {}, weekPSE: {}, exercises: bancoEx };

  it('semana vazia → substitui', () => {
    expect(semanaVazia({})).toBe(true);
    expect(decidirSincronizacao({ ...base, weekLog: {}, fingerprintImportada: null })).toBe('substituir');
  });
  it('sem progresso e semana igual à última importada → substitui', () => {
    expect(decidirSincronizacao({ ...base, weekLog: semana(), fingerprintImportada: fp })).toBe('substituir');
  });
  it('com progresso → pergunta (mesmo que a semana seja a importada)', () => {
    expect(decidirSincronizacao({ ...base, weekLog: semana(), exDone: { '0:0': true }, fingerprintImportada: fp })).toBe('perguntar');
  });
  it('aluno editou o plano (sem treinar) → pergunta', () => {
    expect(decidirSincronizacao({ ...base, weekLog: semana({ sets: 5 }), fingerprintImportada: fp })).toBe('perguntar');
  });
  it('semana não vazia de origem desconhecida (sem impressão digital) → pergunta', () => {
    expect(decidirSincronizacao({ ...base, weekLog: semana(), fingerprintImportada: null })).toBe('perguntar');
  });
});
