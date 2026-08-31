import type { DayIndex, ExDoneMap, WeekLog } from './workout';

export type SessaoStatus = 'ativo' | 'pausado' | 'nao-iniciado' | 'concluido';

/**
 * Uma sessão de treino aberta em aba — o Personal acompanhando um aluno
 * ao vivo (presencial), no mesmo dispositivo. Isolada das outras abas e
 * do "Meu Treino" do próprio Personal: cada uma carrega seu próprio
 * `weekLog`/`exDone` dentro de useWorkoutStore só enquanto está em foco
 * (ver useSessionStore.alternarSessao) — nunca mistura dados entre abas.
 *
 * Escopo deliberado: o weekLog daqui é local a este dispositivo/sessão,
 * não é o mesmo weekLog que o aluno vê no próprio aparelho dele (esse
 * continua sendo dele, sincronizado só com o backup pessoal dele). Isto
 * aqui é o registro do Personal do que foi feito na sessão presencial.
 */
export interface SessaoTreino {
  id: string;
  alunoId: string;
  alunoNome: string;
  criada: string;
  weekLog: WeekLog;
  weekPSE: Record<number, number>;
  exDone: ExDoneMap;
  selectedDay: DayIndex;
}
