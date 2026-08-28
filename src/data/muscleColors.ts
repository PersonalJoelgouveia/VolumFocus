import type { ExerciseAgonist } from '../types/exercise';

/**
 * Migrado 1:1 de `const MC` (index.html ~4076).
 * Cor de destaque por grupo muscular / agonista, usada em barras de volume,
 * badges de 1RM e itens de preview de importação.
 */
export const MUSCLE_COLOR: Record<ExerciseAgonist, string> = {
  Peito: '#ff4d6d',
  Costas: '#38bdf8',
  Quadríceps: '#fbbf24',
  Isquiotibiais: '#fb923c',
  Glúteos: '#f472b6',
  Ombros: '#a78bfa',
  Bíceps: '#34d399',
  Tríceps: '#f87171',
  Panturrilhas: '#5eead4',
  Abdômen: '#fde68a',
  'Extensores da Coluna': '#86efac',
  Cardio: '#22d3a0',
};
