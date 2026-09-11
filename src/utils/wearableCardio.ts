/**
 * Integração Wearable → Cardio (ver CardioView/CardioSessionsCard/CardioGoalCard).
 * Nada aqui toca em weekLog/CardioLogEntry: sessões wearable são uma fonte
 * paralela, só de LEITURA/exibição, combinada com o registro manual na UI —
 * mesma decisão de privacidade já documentada em useWearableStore/SaudeView
 * (dado de saúde não é escrito de volta no log sincronizado).
 */

import type { DayIndex } from '../types/workout';
import type { CardioZone } from '../types/cardioTest';
import type { DateRange, HeartRateSample } from '../lib/wearables';

/**
 * `activityType` é a string livre que vem do plugin (@capgo/capacitor-health,
 * ver HealthConnectProvider/HealthKitProvider) — não há enum fechado no
 * contrato. Classificação por palavra-chave (case-insensitive, substring) é
 * uma heurística deliberada; ajustar as listas abaixo se, em device real,
 * algum tipo comum escapar. `NON_CARDIO_KEYWORDS` tem prioridade (evita, por
 * ex., "strength_training_interval" cair como cardio).
 */
const CARDIO_KEYWORDS = [
  'run', 'walk', 'cycl', 'bike', 'bik', 'swim', 'row', 'elliptical',
  'hiit', 'interval', 'aerobic', 'cardio', 'hik', 'stair', 'dance', 'ski', 'jump',
];
const NON_CARDIO_KEYWORDS = ['strength', 'weight', 'yoga', 'pilates', 'stretch', 'mobility'];

export function isCardioActivityType(activityType: string): boolean {
  const t = activityType.toLowerCase();
  if (NON_CARDIO_KEYWORDS.some((k) => t.includes(k))) return false;
  return CARDIO_KEYWORDS.some((k) => t.includes(k));
}

const ACTIVITY_LABELS: [string, string][] = [
  ['running', 'Corrida'], ['run', 'Corrida'],
  ['walking', 'Caminhada'], ['walk', 'Caminhada'],
  ['cycling', 'Ciclismo'], ['cycl', 'Ciclismo'], ['biking', 'Ciclismo'], ['bike', 'Ciclismo'], ['bik', 'Ciclismo'],
  ['swimming', 'Natação'], ['swim', 'Natação'],
  ['rowing', 'Remo'], ['row', 'Remo'],
  ['elliptical', 'Elíptico'],
  ['hiit', 'HIIT'], ['interval', 'Intervalado'],
  ['hiking', 'Trilha'], ['hik', 'Trilha'],
  ['stair', 'Escada'], ['dance', 'Dança'], ['ski', 'Esqui'], ['jump', 'Pular Corda'],
];

/** Rótulo em pt-BR pro badge da sessão — cai em "Cardio" genérico se nenhuma
 *  palavra-chave conhecida bater (sessão ainda assim é exibida). */
export function cardioActivityLabel(activityType: string): string {
  const t = activityType.toLowerCase();
  for (const [key, label] of ACTIVITY_LABELS) {
    if (t.includes(key)) return label;
  }
  return 'Cardio';
}

/** Segunda=0 ... Domingo=6 — mesma convenção de DayIndex/weekLog (types/workout.ts). */
export function dayIndexOfDate(date: Date): DayIndex {
  const jsDay = date.getDay(); // 0=Domingo...6=Sábado
  return ((jsDay + 6) % 7) as DayIndex;
}

/** [segunda 00:00:00.000, domingo 23:59:59.999] da semana corrente — mesma
 *  semana "rolante" que weekLog representa (sem datas reais persistidas). */
export function currentWeekRange(now: Date = new Date()): DateRange {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - dayIndexOfDate(now));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start, end };
}

export interface ZoneTime {
  key: string;
  name: string;
  cls: string;
  minutes: number;
}

export interface WearableCardioSession {
  id: string;
  dayIndex: DayIndex;
  start: Date;
  activityType: string;
  label: string;
  durationMin: number;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  /** null quando não há teste cardio salvo (sem faixas de bpm pra classificar)
   *  ou não há amostras de FC pra essa sessão — nunca um array vazio. */
  zoneTimes: ZoneTime[] | null;
  /** true quando um CardioLogEntry manual do mesmo dia, com duração
   *  parecida, já existe — a sessão continua visível mas não soma na meta. */
  isDuplicate: boolean;
}

/** Cada par de amostras consecutivas contribui pra zona da FC média do par,
 *  por até `GAP_CAP_MIN` — evita que uma leitura esparsa (comum no Health
 *  Connect) infle uma zona com um buraco de amostragem grande. Amostra fora
 *  de todas as faixas cai na mais próxima (abaixo da mínima → 1ª zona; acima
 *  da máxima → última). Retorna `null` sem faixas ou com <2 amostras. */
const GAP_CAP_MIN = 3;

export function bucketTimeInZones(samples: HeartRateSample[], zones: CardioZone[]): ZoneTime[] | null {
  if (samples.length < 2 || zones.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const minutesByKey = new Map<string, number>(zones.map((z) => [z.key, 0]));

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const gapMin = Math.min(GAP_CAP_MIN, (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) / 60000);
    if (gapMin <= 0) continue;
    const avgBpm = (a.bpm + b.bpm) / 2;
    const zone =
      zones.find((z) => avgBpm >= z.bpmMin && avgBpm <= z.bpmMax) ??
      (avgBpm < zones[0].bpmMin ? zones[0] : zones[zones.length - 1]);
    minutesByKey.set(zone.key, (minutesByKey.get(zone.key) ?? 0) + gapMin);
  }

  return zones.map((z) => ({ key: z.key, name: z.name, cls: z.cls, minutes: Math.round(minutesByKey.get(z.key) ?? 0) }));
}

/**
 * Heurística de deduplicação manual×wearable: CardioLogEntry (registro
 * manual) não guarda horário, só dia da semana + duração (types/workout.ts),
 * então não dá pra comparar por sobreposição real de horário — o critério é
 * "mesmo dia da semana + duração dentro de uma tolerância". Tolerância é o
 * maior entre `DUPLICATE_TOLERANCE_MIN` minutos e um percentual da duração,
 * pra não engolir sessões realmente diferentes no mesmo dia (ex: caminhada
 * de manhã + corrida à noite) nem deixar passar a mesma sessão por um
 * arredondamento de minutos entre o relato manual e o wearable.
 */
const DUPLICATE_TOLERANCE_MIN = 5;
const DUPLICATE_TOLERANCE_PCT = 0.2;

export function markDuplicates(
  sessions: Omit<WearableCardioSession, 'isDuplicate'>[],
  manualDurationsByDay: Record<number, number[]>
): WearableCardioSession[] {
  return sessions.map((s) => {
    const manualDurations = manualDurationsByDay[s.dayIndex] ?? [];
    const tolerance = Math.max(DUPLICATE_TOLERANCE_MIN, s.durationMin * DUPLICATE_TOLERANCE_PCT);
    const isDuplicate = manualDurations.some((d) => Math.abs(d - s.durationMin) <= tolerance);
    return { ...s, isDuplicate };
  });
}
