import { useLocaleStore } from '../store/useLocaleStore';
import { translations } from './translations';
import { EXERCISE_NAMES } from './exerciseNames';
import { MUSCLE_LABELS } from './muscleGroups';
import type { Exercise, MuscleGroup } from '../types/exercise';

/** Hook de tradução simples — sem lib externa (projeto não usa nenhuma hoje). Chave ausente cai pro próprio key como fallback visível em dev. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: string) => translations[locale]?.[key] ?? key;
}

/**
 * Nome de exibição do exercício no locale ativo. `ex.name` (pt-BR) continua
 * sendo o valor canônico armazenado/usado pra matching em todo o app — este
 * hook só resolve a apresentação, e cai de volta pro `ex.name` em pt-BR ou
 * pra exercícios fora do banco padrão (criados por usuário/PT) em qualquer
 * locale, já que esses não têm tradução formal cadastrada.
 */
export function useExerciseName() {
  const locale = useLocaleStore((s) => s.locale);
  return (ex: Exercise) => {
    if (locale === 'pt-BR') return ex.name;
    return EXERCISE_NAMES[ex.id]?.[locale] ?? ex.name;
  };
}

/** Rótulo de exibição de um grupo muscular (ou 'Cardio') no locale ativo. */
export function useMuscleLabel() {
  const locale = useLocaleStore((s) => s.locale);
  return (group: MuscleGroup | 'Cardio') => MUSCLE_LABELS[locale][group] ?? group;
}
