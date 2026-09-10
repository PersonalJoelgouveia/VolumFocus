import type { StrCalcAllResult, StrFormulaDef, StrFormulaKey, StrLevel, StrZone } from '../types/strength';

/**
 * Migrado fielmente de strState + STR_FORMULAS + strCalcAll() (index.html
 * ~7868-7951, ~9113-9216): mesmas 3 fórmulas de 1RM + a híbrida com pesos
 * dinâmicos por faixa de reps, mesma tabela de zonas de prescrição, mesma
 * tabela de níveis por 1RM absoluto.
 */

export const STR_FORMULAS: Record<StrFormulaKey, StrFormulaDef> = {
  hibrida: { key: 'hibrida', label: 'Híbrida', desc: 'Média ponderada — Epley + Brzycki + Lombardi' },
  epley: { key: 'epley', label: 'Epley', desc: 'W × (1 + R / 30)' },
  brzycki: { key: 'brzycki', label: 'Brzycki', desc: 'W ÷ (1.0278 − 0.0278 × R)  [máx 36 reps]' },
  lombardi: { key: 'lombardi', label: 'Lombardi', desc: 'W × R^0.10' },
};

export const STR_FORMULA_ORDER: StrFormulaKey[] = ['hibrida', 'epley', 'brzycki', 'lombardi'];

/** Zonas de treinamento com metadados de prescrição. */
export const ZONES: StrZone[] = [
  { name: 'Força Pura / Potência', pct: 0.9, reps: '1 – 3', cssClass: 'str-zone-high' },
  { name: 'Hipertrofia Miofibrilar', pct: 0.8, reps: '6 – 8', cssClass: 'str-zone-med' },
  { name: 'Hipertrofia Sarcoplasmática', pct: 0.7, reps: '10 – 12', cssClass: 'str-zone-med' },
  { name: 'Resistência de Força', pct: 0.55, reps: '15 – 20', cssClass: 'str-zone-low' },
];

/** Tabela de níveis baseada no 1RM absoluto (kg). */
export const LEVELS: StrLevel[] = [
  { threshold: 0, key: 'iniciante', label: 'Iniciante', cssClass: 'str-badge-iniciante' },
  { threshold: 70, key: 'intermediario', label: 'Intermediário', cssClass: 'str-badge-intermediario' },
  { threshold: 110, key: 'avancado', label: 'Avançado', cssClass: 'str-badge-avancado' },
  { threshold: 160, key: 'elite', label: 'Elite Profissional', cssClass: 'str-badge-elite' },
];

/** Mensagens do slider de RIR (0–5) — migrado de strOnRirChange(). */
export const RIR_MESSAGES = [
  'Falha total — você não conseguiria mais uma rep.',
  'Quase na falha — apenas 1 rep sobrando.',
  'Esforço alto — 2 reps sobrando.',
  'Esforço moderado — 3 reps sobrando.',
  '4 reps sobrando — zona de treino confortável.',
  '5 reps sobrando — aquecimento / técnica.',
];

function calcEpley(w: number, r: number): number {
  return w * (1 + r / 30);
}
function calcBrzycki(w: number, r: number): number | null {
  return r >= 37 ? null : w / (1.0278 - 0.0278 * r);
}
function calcLombardi(w: number, r: number): number {
  return w * Math.pow(r, 0.1);
}

/**
 * Calcula 1RM pelas 3 fórmulas + híbrida. Reps efetivas = reps + RIR
 * (calculado pelo chamador, não aqui — mesma separação de responsabilidade
 * do original).
 */
export function strCalcAll(w: number, r: number): StrCalcAllResult {
  const epleyRaw = calcEpley(w, r);
  const brzyckiRaw = calcBrzycki(w, r);
  const lombardiRaw = calcLombardi(w, r);

  const epley = Math.round(epleyRaw * 10) / 10;
  const brzycki = brzyckiRaw != null ? Math.round(brzyckiRaw * 10) / 10 : null;
  const lombardi = Math.round(lombardiRaw * 10) / 10;

  // Híbrida: média ponderada dinâmica conforme faixa de reps — Epley pesa
  // mais em reps altas, Brzycki em reps baixas, Lombardi equilibra.
  let wEpley = 1;
  let wBrzycki = 1;
  let wLombardi = 1;
  if (r <= 5) {
    wBrzycki = 1.4;
    wEpley = 0.8;
  } else if (r <= 10) {
    wEpley = 1.2;
    wBrzycki = 1.1;
  } else {
    wEpley = 1.3;
    wLombardi = 1.1;
  }

  const weighted = [
    { val: epley, w: wEpley },
    { val: brzycki, w: wBrzycki },
    { val: lombardi, w: wLombardi },
  ].filter((x): x is { val: number; w: number } => x.val != null);

  let hibrida: number | null = null;
  if (weighted.length) {
    const sumW = weighted.reduce((a, x) => a + x.w, 0);
    const sumV = weighted.reduce((a, x) => a + x.val * x.w, 0);
    hibrida = Math.round((sumV / sumW) * 10) / 10;
  }

  return { epley, brzycki, lombardi, hibrida };
}

/** Retorna o nível correspondente ao 1RM informado. */
export function getLevel(oneRM: number): StrLevel {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (oneRM >= l.threshold) level = l;
  }
  return level;
}
