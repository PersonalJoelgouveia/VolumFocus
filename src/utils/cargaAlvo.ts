import type { StrFormulaKey, StrRecord } from '../types/strength';
import { strCalcAll } from './strengthCalc';

/**
 * Carga (kg) que corresponde a `reps` repetições máximas, dado um 1RM.
 * Inverte a MESMA fórmula usada no teste (strCalcAll): todas são lineares em
 * W, então W = 1RM / k(reps), com k obtido da própria strCalcAll — nenhuma
 * fórmula é reescrita aqui. Retorna null se não for calculável.
 */
export function cargaParaReps(oneRM: number, reps: number, formula: StrFormulaKey = 'hibrida'): number | null {
  if (!(oneRM > 0) || !(reps >= 1)) return null;
  const ESCALA = 1000; // evita o arredondamento de 0,1 kg do strCalcAll
  const all = strCalcAll(ESCALA, reps);
  const k = (all[formula] ?? all.hibrida) != null ? ((all[formula] ?? all.hibrida) as number) / ESCALA : null;
  if (!k || k <= 0) return null;
  return oneRM / k;
}

/** Formato obrigatório: XX,XX kg (vírgula decimal, 2 casas). */
export function formatarCarga(kg: number): string {
  return `${kg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export interface CargaAlvoResultado {
  carga: number;
  oneRM: number;
  formula: StrFormulaKey;
  /** Data do teste (como salva no recorde). */
  dataTeste: string;
}

/** Carga alvo a partir do recorde de teste salvo do exercício (nunca de estimativa). */
export function cargaAlvoDoTeste(record: StrRecord | undefined, reps: number): CargaAlvoResultado | null {
  if (!record) return null;
  const formula = record.formula || 'hibrida';
  const carga = cargaParaReps(record.oneRM, reps, formula);
  return carga == null ? null : { carga, oneRM: record.oneRM, formula, dataTeste: record.date };
}

/** Estimativa SEM teste: a partir de uma série submáxima informada (carga × reps até a falha). */
export function estimarPesoIdeal(carga: number, repsFeitas: number, repsPrescritas: number): { oneRM: number; carga: number } | null {
  if (!(carga > 0) || !(repsFeitas >= 1)) return null;
  const oneRM = strCalcAll(carga, repsFeitas).hibrida;
  if (!oneRM) return null;
  const alvo = cargaParaReps(oneRM, repsPrescritas, 'hibrida');
  return alvo == null ? null : { oneRM, carga: alvo };
}
