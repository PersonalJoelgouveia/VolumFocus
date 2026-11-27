import type { Exercise } from '../types/exercise';
import type { ExDoneMap, WeekLog } from '../types/workout';
import type { HistoricoSemana } from '../types/history';
import type { RetroWeek } from '../store/useRetroWeeksStore';
import { dateKey, mondayOf, parseWeekKey } from './retroWeek';

/**
 * Performance do ALUNO na nuvem: uma "semana" por documento em `alunos/{email}/performanceSemanas/{segunda}`,
 * gravada só pelo app do próprio aluno e lida pelo Personal dono no perfil do cliente. Cada documento leva
 * os metadados dos exercícios usados (o aluno pode ter exercícios personalizados que o Personal não tem).
 */
export type OrigemSemana = 'atual' | 'retro' | 'historico';

export interface ExercicioResumo {
  id: string;
  name: string;
  agonist: string;
  type?: 'cardio';
  synergist: string[];
  stabilizer: string[];
}

export interface SemanaDoc {
  semana: string;
  origem: OrigemSemana;
  weekLog: WeekLog;
  weekPSE: Record<string, number>;
  /** Ausente em semanas arquivadas (sem marcação granular ⇒ tudo conta como feito). */
  exDone?: ExDoneMap;
  exercicios: ExercicioResumo[];
  atualizadoEm: string;
}

export const MAX_EXERCICIOS_SEMANA = 80;

function temTreino(w: WeekLog): boolean {
  return Object.values(w).some((d) => (d ?? []).length > 0);
}

function resumirExercicios(weekLog: WeekLog, exercises: Exercise[]): ExercicioResumo[] {
  const ids = new Set<string>();
  Object.values(weekLog).forEach((d) => (d ?? []).forEach((e) => ids.add(e.exId)));
  const out: ExercicioResumo[] = [];
  for (const id of ids) {
    const ex = exercises.find((x) => x.id === id);
    if (!ex) continue;
    out.push({
      id: ex.id,
      name: ex.name.slice(0, 120),
      agonist: ex.agonist,
      ...(ex.type ? { type: ex.type } : {}),
      synergist: [...ex.synergist],
      stabilizer: [...ex.stabilizer],
    });
    if (out.length >= MAX_EXERCICIOS_SEMANA) break;
  }
  return out;
}

function limpar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T; // remove undefined (Firestore não aceita)
}

export interface EntradaSync {
  weekLog: WeekLog;
  weekPSE: Record<number, number>;
  exDone: ExDoneMap;
  retro: Record<string, RetroWeek>;
  historico: HistoricoSemana[];
  exercises: Exercise[];
  now?: Date;
}

/**
 * Semanas a publicar, por segunda-feira. Prioridade igual à do grid: atual > retroativa > arquivada.
 * Semanas sem nenhum treino não geram documento.
 */
export function montarSemanas(e: EntradaSync): Record<string, SemanaDoc> {
  const now = e.now ?? new Date();
  const iso = now.toISOString();
  const out: Record<string, SemanaDoc> = {};

  const put = (key: string, origem: OrigemSemana, weekLog: WeekLog, weekPSE: Record<number, number>, exDone?: ExDoneMap) => {
    if (out[key] || !temTreino(weekLog)) return;
    out[key] = limpar({
      semana: key,
      origem,
      weekLog,
      weekPSE: weekPSE as Record<string, number>,
      ...(exDone ? { exDone } : {}),
      exercicios: resumirExercicios(weekLog, e.exercises),
      atualizadoEm: iso,
    });
  };

  put(dateKey(mondayOf(now)), 'atual', e.weekLog, e.weekPSE, e.exDone);
  Object.entries(e.retro).forEach(([k, w]) => put(k, 'retro', w.weekLog, w.weekPSE, w.exDone));
  e.historico.forEach((h) => {
    if (!h?.data) return;
    put(dateKey(mondayOf(new Date(h.data))), 'historico', h.weekLog, h.weekPSE ?? {});
  });
  return out;
}

/** Conteúdo comparável (sem o carimbo de hora) — só regrava o que realmente mudou. */
export function assinaturaSemana(d: SemanaDoc): string {
  return JSON.stringify({ s: d.semana, o: d.origem, l: d.weekLog, p: d.weekPSE, x: d.exDone ?? null, e: d.exercicios });
}

/** Semana que existia na nuvem e agora está vazia: publica um documento vazio (sem apagar). */
export function semanaVazia(key: string, now: Date = new Date()): SemanaDoc {
  return { semana: key, origem: 'retro', weekLog: {}, weekPSE: {}, exercicios: [], atualizadoEm: now.toISOString() };
}

const ORIGENS: OrigemSemana[] = ['atual', 'retro', 'historico'];

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Lê um documento remoto sem confiar nele; qualquer inconsistência ⇒ null (ignorado). */
export function validarSemanaRemota(raw: unknown, docId: string): SemanaDoc | null {
  if (!ehObjeto(raw)) return null;
  if (raw.semana !== docId || !/^\d{4}-\d{2}-\d{2}$/.test(docId)) return null;
  if (!ORIGENS.includes(raw.origem as OrigemSemana)) return null;
  if (!ehObjeto(raw.weekLog) || !ehObjeto(raw.weekPSE)) return null;
  if (raw.exDone !== undefined && !ehObjeto(raw.exDone)) return null;
  if (!Array.isArray(raw.exercicios) || typeof raw.atualizadoEm !== 'string') return null;

  const weekLog: WeekLog = {};
  for (const [k, v] of Object.entries(raw.weekLog)) {
    const d = Number(k);
    if (!Number.isInteger(d) || d < 0 || d > 6 || !Array.isArray(v)) return null;
    // Cada entrada precisa ter exId string; o resto é lido defensivamente na tela.
    if (!v.every((x) => ehObjeto(x) && typeof x.exId === 'string')) return null;
    weekLog[d] = v as never;
  }
  const exercicios: ExercicioResumo[] = [];
  for (const x of raw.exercicios.slice(0, MAX_EXERCICIOS_SEMANA)) {
    if (!ehObjeto(x) || typeof x.id !== 'string' || typeof x.name !== 'string' || typeof x.agonist !== 'string') return null;
    exercicios.push({
      id: x.id,
      name: x.name,
      agonist: x.agonist,
      ...(x.type === 'cardio' ? { type: 'cardio' as const } : {}),
      synergist: Array.isArray(x.synergist) ? x.synergist.filter((s): s is string => typeof s === 'string') : [],
      stabilizer: Array.isArray(x.stabilizer) ? x.stabilizer.filter((s): s is string => typeof s === 'string') : [],
    });
  }
  return {
    semana: docId,
    origem: raw.origem as OrigemSemana,
    weekLog,
    weekPSE: raw.weekPSE as Record<string, number>,
    ...(raw.exDone ? { exDone: raw.exDone as ExDoneMap } : {}),
    exercicios,
    atualizadoEm: raw.atualizadoEm,
  };
}

/** Segunda-feira de uma semana (Date local) — atalho para telas. */
export function dataDaSemana(key: string): Date {
  return parseWeekKey(key);
}
