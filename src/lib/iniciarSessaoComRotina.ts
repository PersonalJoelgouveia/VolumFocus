import type { AlunoRotina } from '../types/aluno';
import { useSessionStore } from '../store/useSessionStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useSyncStore } from '../store/useSyncStore';
import { buildWeekLogFromAlunoRotina } from '../utils/importAlunoRotina';

export type ResultadoIniciarSessao = { ok: true; novosExercicios: string[] } | { ok: false; motivo: 'limite' };

/**
 * Personal: abre (ou foca a já existente) sessão do aluno na tela inicial e carrega a semana
 * Seg–Dom da rotina dada, pronta para treinar. Só mexe na semana DA SESSÃO — o "Meu Treino"
 * do Personal fica guardado no snapshot de useSessionStore. Não grava nada no Firestore.
 */
export function iniciarSessaoComRotina(alunoId: string, alunoNome: string, rotina: AlunoRotina): ResultadoIniciarSessao {
  const sessoes = useSessionStore.getState();
  const existente = sessoes.sessions.find((s) => s.alunoId === alunoId);
  if (existente) {
    sessoes.alternarSessao(existente.id);
  } else if (!sessoes.abrirNovaSessao(alunoId, alunoNome)) {
    return { ok: false, motivo: 'limite' };
  }

  const banco = [...useExerciseStore.getState().exercises];
  const addExercise = useExerciseStore.getState().addExercise;
  const { weekLog, novosExercicios } = buildWeekLogFromAlunoRotina(rotina, banco, (ex) => {
    addExercise(ex);
    banco.push(ex);
  });

  // Dado de sessão não pode subir para o backup pessoal (mesma regra do swap de abas).
  const sync = useSyncStore.getState();
  sync.pauseWatchers();
  try {
    useWorkoutStore.setState({ weekLog, weekPSE: {}, exDone: {} });
  } finally {
    sync.resumeWatchers();
  }
  return { ok: true, novosExercicios };
}
