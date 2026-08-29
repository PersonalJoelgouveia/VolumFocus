/**
 * Tipos do domínio "Treino / Log Diário".
 * Migrados fielmente das estruturas usadas no monolito:
 *  - weekLog[selectedDay] -> WorkoutDayLog (index.html ~4318, ~4326)
 *  - entry de força criado em confirmAddEx() (index.html ~6251)
 *  - entry de cardio criado em confirmAddEx() (index.html ~6236)
 *  - rotina criada em _savRotina() (index.html ~5763)
 */

import type { HrZone } from './cardio';

export const DAYS = [
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
  'Domingo',
] as const;

export const DAYS_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;

/** Índice 0-6 (Segunda=0 ... Domingo=6), igual ao `selectedDay` do monolito. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TrainingLevel = 'iniciante' | 'intermediario' | 'avancado';

/** Tipo de agrupamento "Conjugar" (cj- namespace, index.html ~9573-9595). */
export type GroupType = 'biset' | 'triset' | 'supersets' | 'circuito';

export const GROUP_LABELS: Record<GroupType, string> = {
  biset: 'Bi-Set',
  triset: 'Tri-Set',
  supersets: 'Superset',
  circuito: 'Circuito',
};

/** Campos de agrupamento compartilhados por qualquer tipo de entrada de log. */
interface GroupableEntry {
  groupId?: string;
  groupType?: GroupType;
}

/** Entrada de exercício de força no log do dia. */
export interface StrengthLogEntry extends GroupableEntry {
  exId: string;
  type?: undefined;
  sets: number;
  reps: number;
  load: number;
  serieLoads: number[];
  serieReps: number[];
  notes?: string;
}

/** Entrada de exercício cardio no log do dia. */
export interface CardioLogEntry extends GroupableEntry {
  exId: string;
  type: 'cardio';
  duration: number;
  intensity: number;
  hrZone: HrZone;
  notes?: string;
  distance?: number;
  avgHr?: number;
}

export type WorkoutLogEntry = StrengthLogEntry | CardioLogEntry;

export function isCardioLogEntry(entry: WorkoutLogEntry): entry is CardioLogEntry {
  return entry.type === 'cardio';
}

/** Log de um dia da semana: lista ordenada de exercícios executados/prescritos. */
export type WorkoutDayLog = WorkoutLogEntry[];

/** weekLog completo — chave é o índice do dia (persistido como string em jg3_log). */
export type WeekLog = Record<number, WorkoutDayLog>;

/** Rotina salva pelo usuário ou por um Personal Trainer (jg3_rotinas / jg3_rotinas_personal).
 *  `log` é a SEMANA inteira (WeekLog), não um único dia — confirmado em
 *  _savRotina(nome, weekLog) (index.html ~5763, chamada em ~5741 e ~5908). */
export interface Rotina {
  id: number;
  nome: string;
  log: WeekLog;
  criada: string;
}

/**
 * Estado de "concluído" de uma série dentro do modal de execução.
 * Persistido em jg3_ex_done com chave `${dayIdx}:${logIdx}` (index.html ~9831).
 */
export type ExDoneKey = `${number}:${number}`;
export type ExDoneMap = Record<ExDoneKey, true>;

export function exDoneKey(dayIdx: number, logIdx: number): ExDoneKey {
  return `${dayIdx}:${logIdx}`;
}
