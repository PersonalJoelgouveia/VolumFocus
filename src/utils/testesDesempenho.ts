import type { CardioTestResult } from '../types/cardioTest';
import type { StrFormulaKey, StrRecord } from '../types/strength';
import type { StrHistoryEntry } from '../store/useStrengthStore';
import { STR_FORMULAS } from './strengthCalc';

/** Teste de Força (1RM) gravado em alunos/{email}/testesDesempenho. */
export interface TesteForcaDoc {
  id: string;
  tipo: 'forca';
  /** ISO 8601. */
  data: string;
  exercise: string;
  weight: number;
  reps: number;
  rir: number;
  oneRM: number;
  formula: StrFormulaKey;
  autorEmail: string;
}

/** Teste Cardiorrespiratório gravado em alunos/{email}/testesDesempenho. */
export interface TesteCardioDoc {
  id: string;
  tipo: 'cardio';
  data: string;
  resultado: CardioTestResult;
  autorEmail: string;
}

export type TesteDesempenhoDoc = TesteForcaDoc | TesteCardioDoc;

const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const str = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

/**
 * Valida um documento vindo da nuvem (pode ter sido gravado por cliente adulterado). Usa o id do
 * DOCUMENTO, nunca o do conteúdo. Malformado → null (ignorado, nunca derruba a tela).
 */
export function validarTesteRemoto(raw: unknown, docId: string): TesteDesempenhoDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (!str(d.data, 40) || Number.isNaN(Date.parse(d.data))) return null;
  const autorEmail = typeof d.autorEmail === 'string' ? d.autorEmail : '';
  if (d.tipo === 'forca') {
    if (!str(d.exercise, 200) || !num(d.weight, 0.1, 2000) || !num(d.reps, 1, 100) || !num(d.rir, 0, 20) || !num(d.oneRM, 0.1, 3000)) return null;
    const formula = (typeof d.formula === 'string' && d.formula in STR_FORMULAS ? d.formula : 'hibrida') as StrFormulaKey;
    return { id: docId, tipo: 'forca', data: d.data, exercise: d.exercise, weight: d.weight, reps: d.reps, rir: d.rir, oneRM: d.oneRM, formula, autorEmail };
  }
  if (d.tipo === 'cardio') {
    const r = d.resultado as Record<string, unknown> | undefined;
    const inputs = r?.inputs as Record<string, unknown> | undefined;
    if (!r || !inputs) return null;
    if (!num(r.vo2, 1, 150)) return null;
    if (inputs.modality !== 'esteira' && inputs.modality !== 'bike') return null;
    if (!str(inputs.protocol, 40)) return null;
    const cls = r.classification as Record<string, unknown> | undefined;
    if (!cls || !str(cls.label, 60) || typeof cls.cls !== 'string') return null;
    if (!Array.isArray(r.zones)) return null;
    return { id: docId, tipo: 'cardio', data: d.data, resultado: { ...(r as unknown as CardioTestResult), id: docId, data: d.data }, autorEmail };
  }
  return null;
}

const ts = (iso: string) => Date.parse(iso) || 0;

/** Força: do conjunto de testes salvos, deriva `records` (melhor 1RM por exercício) e `history` (cronológico). */
export function derivarForca(docs: TesteForcaDoc[]): { records: Record<string, StrRecord>; history: StrHistoryEntry[] } {
  const ordenados = [...docs].sort((a, b) => ts(a.data) - ts(b.data));
  const records: Record<string, StrRecord> = {};
  const history: StrHistoryEntry[] = [];
  for (const d of ordenados) {
    history.push({ exercise: d.exercise, weight: d.weight, reps: d.reps, oneRM: d.oneRM, formula: d.formula, data: d.data });
    const atual = records[d.exercise];
    if (!atual || d.oneRM > atual.oneRM) {
      records[d.exercise] = { weight: d.weight, reps: d.reps, rir: d.rir, oneRM: d.oneRM, formula: d.formula, date: new Date(d.data).toLocaleDateString('pt-BR') };
    }
  }
  return { records, history };
}

/** Cardio: mais recente primeiro (mesma ordem do store local). */
export function derivarCardio(docs: TesteCardioDoc[]): CardioTestResult[] {
  return [...docs].sort((a, b) => ts(b.data) - ts(a.data)).map((d) => d.resultado);
}

/** Junta duas listas de histórico de força (ex.: do Personal + do próprio aluno), sem duplicar. */
export function unirHistoricoForca(a: StrHistoryEntry[], b: StrHistoryEntry[]): StrHistoryEntry[] {
  const vistos = new Set<string>();
  const out: StrHistoryEntry[] = [];
  for (const h of [...a, ...b]) {
    const k = `${h.exercise}|${h.formula}|${h.oneRM}|${h.data}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(h);
  }
  return out.sort((x, y) => ts(x.data) - ts(y.data));
}

/** Por exercício, fica o recorde de teste MAIS RECENTE entre as duas origens (data 'dd/mm/yyyy' ou ISO). */
export function unirRecordes(a: Record<string, StrRecord>, b: Record<string, StrRecord>, parse: (d: string) => number): Record<string, StrRecord> {
  const out: Record<string, StrRecord> = { ...a };
  for (const [nome, r] of Object.entries(b)) {
    const o = out[nome];
    if (!o || parse(r.date) >= parse(o.date)) out[nome] = r;
  }
  return out;
}
