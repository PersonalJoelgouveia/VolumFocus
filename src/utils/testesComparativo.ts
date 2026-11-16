import type { CardioTestResult } from '../types/cardioTest';
import type { StrRecord } from '../types/strength';
import type { StrHistoryEntry } from '../store/useStrengthStore';
import { STR_FORMULAS } from './strengthCalc';
import { CARDIO_PROTOCOLS } from './cardioVo2';

/** Um resultado real armazenado, pronto para comparar. */
export interface PontoTeste {
  id: string;
  /** ms desde epoch (ordenação). */
  ts: number;
  valor: number;
  /** Texto de apoio (ex.: "80kg × 8 reps" ou classificação). */
  detalhe: string;
}

/** Série comparável: só contém resultados do MESMO exercício+fórmula (força) ou modalidade+protocolo (cardio). */
export interface SerieTeste {
  key: string;
  label: string;
  unidade: string;
  pontos: PontoTeste[];
}

export type Tendencia = 'melhora' | 'manutencao' | 'regressao';

/** Variação relativa até ±1% é tratada como manutenção (ruído de medida). */
export const TOLERANCIA_PCT = 1;

export function classificarTendencia(anterior: number, atual: number): { tendencia: Tendencia; delta: number; pct: number } {
  const delta = atual - anterior;
  const pct = anterior !== 0 ? (delta / anterior) * 100 : 0;
  const tendencia: Tendencia = Math.abs(pct) <= TOLERANCIA_PCT ? 'manutencao' : delta > 0 ? 'melhora' : 'regressao';
  return { tendencia, delta, pct };
}

/** Datas legadas de força vêm como 'dd/mm/yyyy' (toLocaleDateString pt-BR). */
export function parseDataPtBr(d: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d ?? '');
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12).getTime();
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
}

export function montarSeriesForca(history: StrHistoryEntry[], records: Record<string, StrRecord>): SerieTeste[] {
  const mapa = new Map<string, SerieTeste>();
  const add = (exercise: string, formula: string, ponto: PontoTeste) => {
    const key = `${exercise}|${formula}`;
    let serie = mapa.get(key);
    if (!serie) {
      const fLabel = STR_FORMULAS[formula as keyof typeof STR_FORMULAS]?.label ?? formula;
      serie = { key, label: `${exercise} · ${fLabel}`, unidade: 'kg', pontos: [] };
      mapa.set(key, serie);
    }
    serie.pontos.push(ponto);
  };
  for (const h of history) {
    add(h.exercise, h.formula, { id: `h-${h.exercise}-${h.data}`, ts: Date.parse(h.data) || 0, valor: h.oneRM, detalhe: `${h.weight}kg × ${h.reps} reps` });
  }
  // Recordes antigos (anteriores ao histórico) entram como ponto-base, sem duplicar.
  for (const [exercise, r] of Object.entries(records)) {
    const formula = r.formula || 'hibrida';
    const existe = history.some((h) => h.exercise === exercise && h.formula === formula && h.oneRM === r.oneRM);
    if (!existe) add(exercise, formula, { id: `r-${exercise}`, ts: parseDataPtBr(r.date), valor: r.oneRM, detalhe: `${r.weight}kg × ${r.reps} reps` });
  }
  for (const s of mapa.values()) s.pontos.sort((a, b) => a.ts - b.ts);
  return [...mapa.values()].sort((a, b) => b.pontos.length - a.pontos.length || a.label.localeCompare(b.label));
}

export function montarSeriesCardio(testes: CardioTestResult[]): SerieTeste[] {
  const mapa = new Map<string, SerieTeste>();
  for (const t of testes) {
    const { modality, protocol } = t.inputs;
    const key = `${modality}|${protocol}`;
    let serie = mapa.get(key);
    if (!serie) {
      const pLabel = CARDIO_PROTOCOLS[modality]?.find((p) => p.value === protocol)?.label ?? protocol;
      serie = { key, label: `${modality === 'bike' ? 'Bike' : 'Esteira'} · ${pLabel}`, unidade: 'ml/kg/min', pontos: [] };
      mapa.set(key, serie);
    }
    serie.pontos.push({ id: t.id, ts: Date.parse(t.data) || 0, valor: t.vo2, detalhe: t.classification.label });
  }
  for (const s of mapa.values()) s.pontos.sort((a, b) => a.ts - b.ts);
  return [...mapa.values()].sort((a, b) => b.pontos.length - a.pontos.length || a.label.localeCompare(b.label));
}
