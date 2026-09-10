import type { Locale } from '../store/useLocaleStore';
import type { MuscleGroup } from '../types/exercise';

/**
 * Rótulos de exibição para grupos musculares. As strings canônicas
 * (MUSCLE_GROUPS, 'Cardio') continuam em pt-BR em todo o resto do app —
 * são chave de agrupamento/filtro/storage (Exercise.agonist/synergist/
 * stabilizer, grouping em BancoView, cores em muscleColors.ts). Este
 * dicionário é só a camada de apresentação, resolvida por useMuscleLabel.
 */
export const MUSCLE_LABELS: Record<Locale, Record<MuscleGroup | 'Cardio', string>> = {
  'pt-BR': {
    Peito: 'Peito',
    Costas: 'Costas',
    Quadríceps: 'Quadríceps',
    Isquiotibiais: 'Isquiotibiais',
    Glúteos: 'Glúteos',
    Ombros: 'Ombros',
    Bíceps: 'Bíceps',
    Tríceps: 'Tríceps',
    Panturrilhas: 'Panturrilhas',
    Abdômen: 'Abdômen',
    'Extensores da Coluna': 'Extensores da Coluna',
    Cardio: 'Cardio',
  },
  es: {
    Peito: 'Pecho',
    Costas: 'Espalda',
    Quadríceps: 'Cuádriceps',
    Isquiotibiais: 'Isquiotibiales',
    Glúteos: 'Glúteos',
    Ombros: 'Hombros',
    Bíceps: 'Bíceps',
    Tríceps: 'Tríceps',
    Panturrilhas: 'Pantorrillas',
    Abdômen: 'Abdomen',
    'Extensores da Coluna': 'Erectores de la Columna',
    Cardio: 'Cardio',
  },
  en: {
    Peito: 'Chest',
    Costas: 'Back',
    Quadríceps: 'Quadriceps',
    Isquiotibiais: 'Hamstrings',
    Glúteos: 'Glutes',
    Ombros: 'Shoulders',
    Bíceps: 'Biceps',
    Tríceps: 'Triceps',
    Panturrilhas: 'Calves',
    Abdômen: 'Abs',
    'Extensores da Coluna': 'Spinal Erectors',
    Cardio: 'Cardio',
  },
};
