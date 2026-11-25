import { useEffect } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useCardioGoalStore } from '../store/useCardioGoalStore';
import { useUIStore } from '../store/useUIStore';
import { useAuthStore } from '../store/useAuthStore';
import { salvarResumoCardio } from '../lib/cardioSemanalRepository';
import { assinaturaResumo, montarResumoCardio } from '../utils/cardioSemanalAluno';

const DEBOUNCE_MS = 4000;

/**
 * Só no app do ALUNO logado: envia o resumo semanal de cardio dele para a nuvem, para o Personal
 * dono ver ao abrir o perfil. No app do Personal não faz nada — o cardio dele nunca sai do aparelho
 * e nunca entra na meta de nenhum aluno. Falha de rede/Rules é silenciosa (tenta na próxima mudança).
 */
export function useCardioSemanalSync(): void {
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const email = useAuthStore((s) => s.user?.email ?? '');

  useEffect(() => {
    if (!isAlunoMode || !email) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ultima = '';
    let cancelado = false;

    const enviar = async () => {
      const resumo = montarResumoCardio(
        useWorkoutStore.getState().weekLog,
        useExerciseStore.getState().exercises,
        useCardioGoalStore.getState().metaMin,
        new Date(),
        useWorkoutStore.getState().exDone
      );
      const ass = assinaturaResumo(resumo);
      if (ass === ultima) return;
      try {
        await salvarResumoCardio(email, resumo);
        if (!cancelado) ultima = ass;
      } catch (e) {
        console.warn('useCardioSemanalSync: não foi possível enviar o resumo de cardio', e);
      }
    };
    const agendar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void enviar(), DEBOUNCE_MS);
    };

    agendar();
    const unsubs = [
      useWorkoutStore.subscribe(agendar),
      useCardioGoalStore.subscribe(agendar),
      useExerciseStore.subscribe(agendar),
    ];
    return () => {
      cancelado = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [isAlunoMode, email]);
}
