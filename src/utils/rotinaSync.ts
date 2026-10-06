import type { Exercise } from '../types/exercise';
import type { ExDoneMap, WeekLog } from '../types/workout';
import { isCardioLogEntry } from '../types/workout';
import { buildAlunoRotinaFromWeekLog } from './importAlunoRotina';

/**
 * Decisão do sincronismo "rotina ativa do Personal → Semana Atual do aluno".
 * Funções puras: quem aplica/pergunta é o AlunoRotinaSyncBanner.
 */

export function semanaVazia(weekLog: WeekLog): boolean {
  return Object.values(weekLog).every((dia) => !dia || dia.length === 0);
}

/**
 * O aluno JÁ começou a treinar esta semana? Qualquer sinal de EXECUÇÃO conta:
 * exercício concluído no modal, série marcada, PSE do dia, ou dado medido de cardio.
 * (Só a prescrição presente no weekLog NÃO é progresso.)
 */
export function temProgresso(weekLog: WeekLog, exDone: ExDoneMap, weekPSE: Record<number, number>): boolean {
  if (Object.keys(exDone).length > 0 || Object.keys(weekPSE).length > 0) return true;
  return Object.values(weekLog).some((dia) =>
    (dia ?? []).some((e) =>
      isCardioLogEntry(e) ? e.distance !== undefined || e.avgHr !== undefined : (e.doneSerie ?? []).some(Boolean)
    )
  );
}

/** Hash curto (djb2) — só para comparar "a semana mudou desde a última importação?". */
function hash(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Impressão digital da PRESCRIÇÃO da semana (nome, ordem, séries, reps, carga base,
 * notas, grupo) — ignora ids e estado de execução. Reaproveita a conversão
 * WeekLog → AlunoRotina, então "mudou" aqui significa "o aluno editou o plano".
 */
export function fingerprintSemana(weekLog: WeekLog, exercises: readonly Exercise[]): string {
  return hash(JSON.stringify(buildAlunoRotinaFromWeekLog(weekLog, exercises).rotina));
}

export type DecisaoSync = 'substituir' | 'perguntar';

/**
 * - semana vazia → substitui (nada a perder);
 * - sem progresso E semana idêntica à última importada (o aluno não mexeu) → substitui;
 * - qualquer outra coisa (progresso, edição própria, ou origem desconhecida) → pergunta.
 */
export function decidirSincronizacao(args: {
  weekLog: WeekLog;
  exDone: ExDoneMap;
  weekPSE: Record<number, number>;
  exercises: readonly Exercise[];
  fingerprintImportada: string | null;
}): DecisaoSync {
  const { weekLog, exDone, weekPSE, exercises, fingerprintImportada } = args;
  if (semanaVazia(weekLog)) return 'substituir';
  if (temProgresso(weekLog, exDone, weekPSE)) return 'perguntar';
  if (fingerprintImportada !== null && fingerprintSemana(weekLog, exercises) === fingerprintImportada) {
    return 'substituir';
  }
  return 'perguntar';
}
