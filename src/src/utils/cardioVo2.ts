import type { CardioProtocol, CardioTestInputs, CardioZone, Vo2Classification } from '../types/cardioTest';

/**
 * Migrado fielmente de `cardioState` + `CARDIO_PROTOCOLS` + `cardioCalc*`
 * (index.html ~8689-9004): tabela de classificação ACSM/Cooper, zonas de
 * Karvonen, e as fórmulas de Bruce/Astrand-Ryhming/Storer-Davis — mesmas
 * constantes, mesma matemática, mesmas unidades.
 *
 * Único protocolo que NÃO vem do HTML de referência: 'cooper12' (Cooper —
 * Teste de 12 Minutos). O arquivo fonte não tem nenhum teste baseado em
 * distância — só Bruce (tempo+FC), Astrand (carga+FC) e Storer (carga+FC).
 * Adicionado por pedido explícito, usando a fórmula padrão de Cooper
 * (1968) e conectado à MESMA tabela de classificação e ao MESMO cálculo
 * de zonas — nenhuma estrutura paralela, só mais uma forma de chegar ao
 * VO2 Máx.
 */

/** Tabela de classificação VO2 Máx por idade/gênero (ml/kg/min) — referência ACSM/Cooper. */
export const VO2_TABLE: Record<'M' | 'F', { maxAge: number; fraco: number; abaixo: number; medio: number; bom: number }[]> = {
  M: [
    { maxAge: 29, fraco: 38, abaixo: 42, medio: 46, bom: 51 },
    { maxAge: 39, fraco: 34, abaixo: 38, medio: 42, bom: 47 },
    { maxAge: 49, fraco: 31, abaixo: 35, medio: 38, bom: 43 },
    { maxAge: 59, fraco: 27, abaixo: 31, medio: 35, bom: 40 },
    { maxAge: 999, fraco: 24, abaixo: 28, medio: 31, bom: 36 },
  ],
  F: [
    { maxAge: 29, fraco: 32, abaixo: 36, medio: 40, bom: 45 },
    { maxAge: 39, fraco: 28, abaixo: 32, medio: 36, bom: 41 },
    { maxAge: 49, fraco: 25, abaixo: 29, medio: 32, bom: 37 },
    { maxAge: 59, fraco: 22, abaixo: 26, medio: 29, bom: 34 },
    { maxAge: 999, fraco: 20, abaixo: 23, medio: 26, bom: 31 },
  ],
};

/** Zonas de treinamento (Karvonen / %FCR). */
export const ZONES: Omit<CardioZone, 'bpmMin' | 'bpmMax'>[] = [
  { key: 'z1', name: 'Z1 · Recuperação', desc: 'Regenerativo / aquecimento', min: 0.5, max: 0.6, cls: 'cardio-z1' },
  { key: 'z2', name: 'Z2 · Lipolítica', desc: 'Queima de gordura / base aeróbica', min: 0.6, max: 0.7, cls: 'cardio-z2' },
  { key: 'z3', name: 'Z3 · Aeróbia', desc: 'Condicionamento cardiovascular', min: 0.7, max: 0.8, cls: 'cardio-z3' },
  { key: 'z4', name: 'Z4 · Limiar', desc: 'Limiar anaeróbico / alta performance', min: 0.8, max: 0.9, cls: 'cardio-z4' },
  { key: 'z5', name: 'Z5 · Esprint', desc: 'Máximo / capacidade anaeróbica', min: 0.9, max: 1.0, cls: 'cardio-z5' },
];

export const CARDIO_PROTOCOLS: Record<'esteira' | 'bike', { value: CardioProtocol; label: string }[]> = {
  esteira: [
    { value: 'bruce', label: 'Bruce (Rampa / Alta Performance)' },
    { value: 'astrand', label: 'Astrand (Submáximo)' },
    { value: 'cooper12', label: 'Cooper — Teste de 12 Minutos (Corrida)' },
  ],
  bike: [
    { value: 'astrand', label: 'Astrand-Ryhming (Carga Constante)' },
    { value: 'storer', label: 'Storer (Carga Incremental)' },
  ],
};

/** FCMáx por Gellish: 207 − 0.7 × idade. */
export function calcFcMaxGellish(age: number): number {
  return Math.round(207 - 0.7 * age);
}

/** Classifica o VO2 Máx (Fraco/Abaixo/Médio/Bom/Excelente) por idade e gênero. */
export function classifyVo2(vo2: number, gender: 'M' | 'F', age: number): Vo2Classification {
  const table = VO2_TABLE[gender] ?? VO2_TABLE.M;
  let row = table[table.length - 1];
  for (const r of table) {
    if (age <= r.maxAge) {
      row = r;
      break;
    }
  }
  if (vo2 < row.fraco) return { key: 'fraco', label: 'Fraco', cls: 'cardio-badge-fraco' };
  if (vo2 < row.abaixo) return { key: 'abaixo', label: 'Abaixo da Média', cls: 'cardio-badge-abaixo' };
  if (vo2 < row.medio) return { key: 'medio', label: 'Médio', cls: 'cardio-badge-medio' };
  if (vo2 < row.bom) return { key: 'bom', label: 'Bom', cls: 'cardio-badge-bom' };
  return { key: 'excelente', label: 'Excelente', cls: 'cardio-badge-excelente' };
}

/** Calcula as 5 zonas de treino pelo método de Karvonen (FCR). */
export function calcKarvonenZones(fcMax: number, fcRest: number): CardioZone[] {
  const fcr = fcMax - fcRest;
  return ZONES.map((z) => ({
    ...z,
    bpmMin: Math.round(fcRest + fcr * z.min),
    bpmMax: Math.round(fcRest + fcr * z.max),
  }));
}

/** Bruce (Esteira, ACSM): VO2max = 14.8 − 1.379×T + 0.451×T² − 0.012×T³ (T em minutos decimais). */
export function calcBruce(timeMin: number): number {
  const t = timeMin;
  return 14.8 - 1.379 * t + 0.451 * t * t - 0.012 * t * t * t;
}

/** Astrand-Ryhming (submáximo, carga constante — esteira ou bike). */
export function calcAstrand(load: number, hr: number, weight: number, age: number, modality: 'esteira' | 'bike'): number {
  let vo2Sub: number;
  if (modality === 'bike') {
    vo2Sub = (load * 12 + 300) / 1000;
  } else {
    const speedMmin = (load * 1000) / 60;
    vo2Sub = ((speedMmin * 0.2 + 3.5) * weight) / 1000;
  }
  const hrMaxRef = 220 - age;
  const vo2MaxLmin = (vo2Sub * (hrMaxRef - 60)) / (hr - 60);
  const ageFactors = [
    { maxAge: 25, f: 1.0 },
    { maxAge: 35, f: 0.87 },
    { maxAge: 45, f: 0.78 },
    { maxAge: 55, f: 0.71 },
    { maxAge: 65, f: 0.65 },
    { maxAge: 999, f: 0.6 },
  ];
  let factor = 1.0;
  for (const af of ageFactors) {
    if (age <= af.maxAge) {
      factor = af.f;
      break;
    }
  }
  const correctedLmin = vo2MaxLmin * factor;
  return (correctedLmin * 1000) / weight;
}

/** Storer-Davis (bike, carga incremental). */
export function calcStorer(wattsMax: number, weight: number, age: number, gender: 'M' | 'F'): number {
  const vo2MlMin =
    gender === 'F'
      ? 9.39 * wattsMax + 7.7 * weight - 5.88 * age + 136.7
      : 10.51 * wattsMax + 6.35 * weight - 10.49 * age + 519.3;
  return vo2MlMin / weight;
}

/** Cooper (1968) — Teste de 12 Minutos: VO2max = (distância_m − 504.9) / 44.73. Não presente no HTML de referência. */
export function calcCooper12(distanceM: number): number {
  return (distanceM - 504.9) / 44.73;
}

/** Converte string "mm.ss" (ex: "12.30") em minutos decimais (ex: 12.5). */
export function parseTimeToDecimal(str: string): number {
  const s = String(str).trim().replace(',', '.');
  const parts = s.split('.');
  const min = parseFloat(parts[0]) || 0;
  const sec = parts[1] ? parseFloat(parts[1].padEnd(2, '0').slice(0, 2)) : 0;
  return min + sec / 60;
}

export interface CardioCalcResult {
  vo2: number;
  fcMax: number;
  fcRest: number;
  fcr: number;
  classification: Vo2Classification;
  zones: CardioZone[];
  formulaUsed: string;
}

/**
 * Orquestra o cálculo completo — sucessor de cardioCalculate() (index.html
 * ~8937-9004): escolhe a fórmula pelo protocolo, prioriza VO2 real de
 * ergoespirometria se informado, prioriza FC real do teste se plausível,
 * e faz o clamp fisiológico [10,90].
 */
export function runCardioCalculation(inputs: CardioTestInputs): CardioCalcResult {
  const { gender, age, weight, fcRest, vo2Ergo, modality, protocol } = inputs;

  let vo2 = 0;
  let fcMax = calcFcMaxGellish(age);
  let formulaUsed = 'Gellish (207 − 0.7 × idade)';
  let fcFinalTest: number | null = null;

  if (protocol === 'bruce') {
    const timeMin = parseTimeToDecimal(inputs.bruceTime ?? '0');
    fcFinalTest = inputs.bruceFc ?? null;
    vo2 = calcBruce(timeMin);
  } else if (protocol === 'astrand') {
    const load = inputs.astrandLoad ?? 0;
    const hr = inputs.astrandFc ?? 0;
    fcFinalTest = hr || null;
    vo2 = calcAstrand(load, hr, weight, age, modality);
  } else if (protocol === 'storer') {
    const wattsMax = inputs.storerLoad ?? 0;
    fcFinalTest = inputs.storerFc ?? null;
    vo2 = calcStorer(wattsMax, weight, age, gender);
  } else if (protocol === 'cooper12') {
    vo2 = calcCooper12(inputs.cooperDistance ?? 0);
  }

  if (vo2Ergo) {
    vo2 = vo2Ergo;
    formulaUsed += ' · VO2 priorizado: Ergoespirometria';
  } else {
    const protocolLabel = (CARDIO_PROTOCOLS[modality] ?? []).find((p) => p.value === protocol);
    formulaUsed += ` · VO2: ${protocolLabel ? protocolLabel.label : protocol}`;
  }

  if (fcFinalTest && fcFinalTest > fcMax - 10) {
    fcMax = fcFinalTest;
    formulaUsed += ' · FCMáx: FC real do teste';
  }

  vo2 = Math.max(10, Math.min(90, vo2));

  return {
    vo2: Math.round(vo2 * 10) / 10,
    fcMax: Math.round(fcMax),
    fcRest,
    fcr: Math.round(fcMax - fcRest),
    classification: classifyVo2(vo2, gender, age),
    zones: calcKarvonenZones(fcMax, fcRest),
    formulaUsed,
  };
}
