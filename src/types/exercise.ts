/**
 * Tipos do domínio "Exercício".
 * Migrado 1:1 da estrutura de DEFAULT_EXERCISES no monolito (index.html linha ~4109).
 * Grupos musculares migrados de MUSCLE_GROUPS (index.html linha ~4069).
 */

export const MUSCLE_GROUPS = [
  'Peito',
  'Costas',
  'Quadríceps',
  'Isquiotibiais',
  'Glúteos',
  'Ombros',
  'Bíceps',
  'Tríceps',
  'Panturrilhas',
  'Abdômen',
  'Extensores da Coluna',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Agonista de exercícios cardio é sempre a string literal 'Cardio' no monolito. */
export type ExerciseAgonist = MuscleGroup | 'Cardio';

export type ExerciseType = 'strength' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  agonist: ExerciseAgonist;
  /** Presente e igual a 'cardio' apenas nos exercícios cardio; ausente (undefined) = força. */
  type?: 'cardio';
  synergist: MuscleGroup[];
  stabilizer: MuscleGroup[];
}

/** Helper de tipagem — equivalente a `ex.type === 'cardio'` usado no monolito. */
export function isCardioExercise(ex: Exercise): boolean {
  return ex.type === 'cardio';
}
