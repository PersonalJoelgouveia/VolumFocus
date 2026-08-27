/**
 * Tipos do domínio "Cardio".
 * Migrados de CARDIO_ZONES (index.html ~4079) e do módulo de VO2/Karvonen (index.html ~8700+).
 */

/** Zona de FC (1-5), igual ao `hrZone` gravado na entrada de log cardio. */
export type HrZone = 1 | 2 | 3 | 4 | 5;

export interface CardioZoneDef {
  id: HrZone;
  label: string;
  pct: string;
  name: string;
  color: string;
}

export const CARDIO_ZONES: CardioZoneDef[] = [
  { id: 1, label: 'Zona 1', pct: '50–60%', name: 'Recuperação', color: '#5eead4' },
  { id: 2, label: 'Zona 2', pct: '60–70%', name: 'Queima de Gordura', color: '#34d399' },
  { id: 3, label: 'Zona 3', pct: '70–80%', name: 'Aeróbico', color: '#fbbf24' },
  { id: 4, label: 'Zona 4', pct: '80–90%', name: 'Limiar Anaeróbico', color: '#fb923c' },
  { id: 5, label: 'Zona 5', pct: '90–100%', name: 'Máximo', color: '#ff4d6d' },
];

/** Zonas de treino pelo método de Karvonen (%FCR), independentes de CARDIO_ZONES (usadas no módulo VO2). */
export interface KarvonenZoneDef {
  key: 'z1' | 'z2' | 'z3' | 'z4' | 'z5';
  name: string;
  desc: string;
  min: number;
  max: number;
}

export const KARVONEN_ZONES: KarvonenZoneDef[] = [
  { key: 'z1', name: 'Z1 · Recuperação', desc: 'Regenerativo / aquecimento', min: 0.5, max: 0.6 },
  { key: 'z2', name: 'Z2 · Lipolítica', desc: 'Queima de gordura / base aeróbica', min: 0.6, max: 0.7 },
  { key: 'z3', name: 'Z3 · Aeróbia', desc: 'Condicionamento cardiovascular', min: 0.7, max: 0.8 },
  { key: 'z4', name: 'Z4 · Limiar', desc: 'Limiar anaeróbico / alta performance', min: 0.8, max: 0.9 },
  { key: 'z5', name: 'Z5 · Esprint', desc: 'Máximo / capacidade anaeróbica', min: 0.9, max: 1.0 },
];

export interface KarvonenZoneResult extends KarvonenZoneDef {
  bpmMin: number;
  bpmMax: number;
}

/** FCMáx por Gellish: 207 - 0.7 × idade (index.html ~8737). */
export function calcFcMaxGellish(age: number): number {
  return Math.round(207 - 0.7 * age);
}

/** Calcula as 5 zonas de treino pelo método de Karvonen (FCR). */
export function calcKarvonenZones(fcMax: number, fcRest: number): KarvonenZoneResult[] {
  const fcr = fcMax - fcRest;
  return KARVONEN_ZONES.map((z) => ({
    ...z,
    bpmMin: Math.round(fcRest + fcr * z.min),
    bpmMax: Math.round(fcRest + fcr * z.max),
  }));
}
