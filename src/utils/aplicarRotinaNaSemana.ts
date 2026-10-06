import type { Exercise } from '../types/exercise';
import type { WeekLog } from '../types/workout';
import type { RotinaAtivaResolvida } from '../lib/rotinaAtivaAluno';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useRotinaSyncStore } from '../store/useRotinaSyncStore';
import { buildWeekLogFromAlunoRotina } from './importAlunoRotina';
import { fingerprintSemana } from './rotinaSync';

export type ModoAplicacao =
  /** Semana sem progresso: a rotina vira a semana inteira (zera PSE/concluídos, que seriam órfãos). */
  | 'substituir-semana'
  /** Aluno confirmou: troca só os dias que a rotina prescreve (comportamento histórico) e limpa
   *  PSE/concluídos desses dias — os índices `dia:posição` passariam a apontar para outros exercícios. */
  | 'mesclar-dias';

/**
 * ÚNICO ponto que grava uma rotina do Personal na Semana Atual (banner automático e
 * importação manual do RotinasModal). Registra a versão vista e a impressão digital
 * da semana resultante, usadas depois para saber se o aluno mexeu.
 */
export function aplicarRotinaNaSemana(
  rotina: RotinaAtivaResolvida,
  exercises: readonly Exercise[],
  addExercise: (ex: Exercise) => void,
  modo: ModoAplicacao
): { novosExercicios: string[] } {
  const bancoAtual = [...exercises];
  const { weekLog: prescrito, novosExercicios } = buildWeekLogFromAlunoRotina(rotina.rotina, bancoAtual, (ex) => {
    addExercise(ex);
    bancoAtual.push(ex);
  });

  const atual = useWorkoutStore.getState();
  let weekLog: WeekLog;
  let weekPSE = atual.weekPSE;
  let exDone = atual.exDone;

  if (modo === 'substituir-semana') {
    weekLog = prescrito;
    weekPSE = {};
    exDone = {};
  } else {
    weekLog = { ...atual.weekLog, ...prescrito };
    const dias = new Set(Object.keys(prescrito));
    weekPSE = Object.fromEntries(Object.entries(atual.weekPSE).filter(([d]) => !dias.has(d)));
    exDone = Object.fromEntries(Object.entries(atual.exDone).filter(([k]) => !dias.has(k.split(':')[0])));
  }

  useWorkoutStore.setState({ weekLog, weekPSE, exDone });
  const sync = useRotinaSyncStore.getState();
  sync.setLastSeenAt(rotina.version);
  sync.setLastImportedFingerprint(fingerprintSemana(weekLog, bancoAtual));
  return { novosExercicios };
}
