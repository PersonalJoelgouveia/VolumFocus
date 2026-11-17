import { describe, expect, it } from 'vitest';
import { PAIRS, LOWER } from '../dashboardData';
import { DEFAULT_EXERCISES } from '../defaultExercises';
import { MUSCLE_GROUPS } from '../../types/exercise';
import { MUSCLE_COLOR } from '../muscleColors';
import { MUSCLE_LABELS } from '../../i18n/muscleGroups';

describe('anatomia (X-ray)', () => {
  it('Flexores do Quadril é grupo próprio, com cor e rótulos', () => {
    expect(MUSCLE_GROUPS).toContain('Flexores do Quadril');
    expect(MUSCLE_COLOR['Flexores do Quadril']).toBeTruthy();
    for (const l of ['pt-BR', 'es', 'en'] as const) expect(MUSCLE_LABELS[l]['Flexores do Quadril']).toBeTruthy();
    expect(LOWER).toContain('Flexores do Quadril');
  });
  it('Glúteos × Flexores do Quadril são antagonistas; extensores da coluna NÃO são antagonistas dos glúteos', () => {
    const par = PAIRS.find((p) => p.ag.muscles[0] === 'Glúteos');
    expect(par?.ant.muscles).toEqual(['Flexores do Quadril']);
    for (const p of PAIRS) {
      const todos = [...p.ag.muscles, ...p.ant.muscles];
      expect(todos.includes('Glúteos') && todos.includes('Extensores da Coluna')).toBe(false);
    }
  });
  it('todo grupo dos pares é válido e há exercícios de flexores do quadril', () => {
    for (const p of PAIRS) for (const m of [...p.ag.muscles, ...p.ant.muscles]) expect(MUSCLE_GROUPS).toContain(m);
    const fx = DEFAULT_EXERCISES.filter((e) => e.agonist === 'Flexores do Quadril');
    expect(fx.length).toBeGreaterThanOrEqual(5);
    expect(fx.some((e) => e.name === 'Flexão de Quadril Unilateral Solo')).toBe(true);
    for (const e of fx) expect(e.synergist).not.toContain('Glúteos');
  });
  it('ids de exercícios padrão são únicos', () => {
    const ids = DEFAULT_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
