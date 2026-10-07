import { criarRotinaVazia } from '../types/aluno';
import type { AlunoRotinaDia } from '../types/aluno';
import type { Exercise } from '../types/exercise';
import type { DayIndex, WeekLog } from '../types/workout';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useSessionStore } from '../store/useSessionStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useSyncStore } from '../store/useSyncStore';
import { buildWeekLogFromAlunoRotina } from '../utils/importAlunoRotina';
import { getTodayDayIndex } from '../utils/dayIndex';

/** Quantos exercícios a Semana Atual em foco já tem em `dia` (0 = livre, sem sobreposição). */
export function exerciciosNoDia(dia: number = getTodayDayIndex()): number {
  return useWorkoutStore.getState().weekLog[dia]?.length ?? 0;
}

/** Idem, para a sessão (aba) de um aluno — aberta em foco ou guardada em segundo plano. 0 se não há sessão. */
export function exerciciosNoDiaDaSessao(alunoId: string, dia: number = getTodayDayIndex()): number {
  const { sessions, activeSessionId } = useSessionStore.getState();
  const sess = sessions.find((s) => s.alunoId === alunoId);
  if (!sess) return 0;
  const log = sess.id === activeSessionId ? useWorkoutStore.getState().weekLog : sess.weekLog;
  return log[dia]?.length ?? 0;
}

/** Monta o log de UM dia a partir de um treino da rotina (cria no banco os exercícios que faltam). */
function montarDia(
  treino: AlunoRotinaDia,
  dia: number,
  exercises: readonly Exercise[],
  addExercise: (ex: Exercise) => void
): { log: WeekLog[number]; novosExercicios: string[] } {
  const temp = criarRotinaVazia();
  temp[dia] = treino;
  const banco = [...exercises];
  const { weekLog, novosExercicios } = buildWeekLogFromAlunoRotina(temp, banco, (ex) => {
    addExercise(ex);
    banco.push(ex);
  });
  return { log: weekLog[dia] ?? [], novosExercicios };
}

/** Coloca o treino em `dia` da semana em foco, zerando PSE/concluídos desse dia (índices antigos ficariam órfãos). */
function colocarNaSemanaEmFoco(treino: AlunoRotinaDia, dia: number): { novosExercicios: string[] } {
  const { log, novosExercicios } = montarDia(
    treino,
    dia,
    useExerciseStore.getState().exercises,
    useExerciseStore.getState().addExercise
  );
  const atual = useWorkoutStore.getState();
  const weekPSE = { ...atual.weekPSE };
  delete weekPSE[dia];
  const exDone = Object.fromEntries(Object.entries(atual.exDone).filter(([k]) => k.split(':')[0] !== String(dia)));
  useWorkoutStore.setState({ weekLog: { ...atual.weekLog, [dia]: log }, weekPSE, exDone, selectedDay: dia as DayIndex });
  return { novosExercicios };
}

/**
 * ALUNO: coloca o treino escolhido (A/B/C…) no dia de HOJE da própria Semana Atual.
 * Quem chama confirma antes se `exerciciosNoDia()` > 0.
 */
export function aplicarTreinoHoje(treino: AlunoRotinaDia): { novosExercicios: string[]; dia: number } {
  const dia = getTodayDayIndex();
  return { ...colocarNaSemanaEmFoco(treino, dia), dia };
}

export type ResultadoIniciarTreino = { ok: true; novosExercicios: string[]; dia: number } | { ok: false; motivo: 'limite' };

/**
 * PERSONAL: abre (ou foca) a sessão do aluno e coloca o treino escolhido no dia de HOJE dela.
 * Os outros dias da sessão ficam intactos. Nada é gravado no Firestore.
 */
export function iniciarSessaoComTreino(alunoId: string, alunoNome: string, treino: AlunoRotinaDia): ResultadoIniciarTreino {
  const sessoes = useSessionStore.getState();
  const existente = sessoes.sessions.find((s) => s.alunoId === alunoId);
  if (existente) sessoes.alternarSessao(existente.id);
  else if (!sessoes.abrirNovaSessao(alunoId, alunoNome)) return { ok: false, motivo: 'limite' };

  const dia = getTodayDayIndex();
  // Dado de sessão não sobe para o backup pessoal (mesma regra do swap de abas).
  const sync = useSyncStore.getState();
  sync.pauseWatchers();
  try {
    const { novosExercicios } = colocarNaSemanaEmFoco(treino, dia);
    return { ok: true, novosExercicios, dia };
  } finally {
    sync.resumeWatchers();
  }
}
