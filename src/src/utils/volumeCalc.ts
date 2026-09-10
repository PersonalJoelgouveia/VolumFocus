import type { Exercise, MuscleGroup } from '../types/exercise';
import type { WeekLog, WorkoutDayLog } from '../types/workout';
import { MUSCLE_GROUPS } from '../types/exercise';
import { isCardioLogEntry } from '../types/workout';
import { LOWER, UPPER, VOL_MAX_LOWER, VOL_MAX_UPPER } from '../data/dashboardData';

export type VolumeByMuscle = Record<MuscleGroup, number>;

function emptyVolumeMap(): VolumeByMuscle {
  const v = {} as VolumeByMuscle;
  MUSCLE_GROUPS.forEach((m) => (v[m] = 0));
  return v;
}

/** Migrado de totalDaySets(d) — usado no grid de seleção de dia do modal Clonar. */
export function totalDaySets(dayIdx: number, weekLog: WeekLog): number {
  const dayLog = weekLog[dayIdx] ?? [];
  return dayLog.reduce((sum, e) => sum + (isCardioLogEntry(e) ? 0 : e.sets), 0);
}

/** Migrado de calcDayVol(d) (index.html ~4330). Agonista=1.0, sinergista=0.5, estabilizador=0.25. */
export function calcDayVolume(dayLog: WorkoutDayLog, exercises: Exercise[]): VolumeByMuscle {
  const v = emptyVolumeMap();
  for (const entry of dayLog) {
    if (isCardioLogEntry(entry)) continue;
    const ex = exercises.find((x) => x.id === entry.exId);
    if (!ex) continue;
    const s = entry.sets || 0;
    if (ex.agonist !== 'Cardio') v[ex.agonist] = (v[ex.agonist] || 0) + s;
    ex.synergist.forEach((m) => (v[m] = (v[m] || 0) + s * 0.5));
    ex.stabilizer.forEach((m) => (v[m] = (v[m] || 0) + s * 0.25));
  }
  return v;
}

/** Migrado de calcWeekVol() (index.html ~4341). */
export function calcWeekVolume(weekLog: WeekLog, exercises: Exercise[]): VolumeByMuscle {
  const v = emptyVolumeMap();
  for (let d = 0; d < 7; d++) {
    const dv = calcDayVolume(weekLog[d] ?? [], exercises);
    MUSCLE_GROUPS.forEach((m) => (v[m] += dv[m]));
  }
  return v;
}

export interface WeekTonnage {
  kg: number;
  reps: number;
  sets: number;
}

/** Migrado de calcWeekTonnage() (index.html ~4346). */
export function calcWeekTonnage(weekLog: WeekLog): WeekTonnage {
  let kg = 0;
  let reps = 0;
  let sets = 0;
  for (let d = 0; d < 7; d++) {
    const dayLog = weekLog[d] ?? [];
    for (const entry of dayLog) {
      if (isCardioLogEntry(entry)) continue;
      const s = entry.sets || 0;
      sets += s;
      for (let i = 0; i < s; i++) {
        const r = entry.serieReps?.[i] ?? entry.reps ?? 0;
        const l = entry.serieLoads?.[i] ?? entry.load ?? 0;
        reps += r;
        kg += r * l;
      }
    }
  }
  return { kg, reps, sets };
}

/** Migrado de isDayOverloaded(d) (index.html ~4361). */
export function isDayOverloaded(dayLog: WorkoutDayLog, exercises: Exercise[]): boolean {
  const dv = calcDayVolume(dayLog, exercises);
  for (const [m, v] of Object.entries(dv)) {
    if (LOWER.includes(m as MuscleGroup) && v > VOL_MAX_LOWER) return true;
    if (UPPER.includes(m as MuscleGroup) && v > VOL_MAX_UPPER) return true;
  }
  return false;
}

/** Migrado de brzycki(w,r) (index.html ~4369). */
export function brzycki(weight: number, reps: number): number | null {
  if (reps >= 37 || weight <= 0) return null;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
}

export interface Top1RM {
  name: string;
  muscle: Exercise['agonist'];
  rm: number;
}

/** Migrado de getTop1RMs() (index.html ~4370) — usa a última série de cada exercício da semana. */
export function getTop1RMs(weekLog: WeekLog, exercises: Exercise[]): Top1RM[] {
  const map = new Map<string, Top1RM>();
  for (let d = 0; d < 7; d++) {
    const dayLog = weekLog[d] ?? [];
    for (const entry of dayLog) {
      if (isCardioLogEntry(entry)) continue;
      const ex = exercises.find((x) => x.id === entry.exId);
      if (!ex) continue;
      const s = entry.sets || 0;
      if (!s) continue;
      const lastLoad = entry.serieLoads?.[s - 1] ?? entry.load;
      const lastReps = entry.serieReps?.[s - 1] ?? entry.reps;
      const rm = brzycki(lastLoad || 0, lastReps || 0);
      const existing = map.get(ex.name);
      if (rm && (!existing || rm > existing.rm)) {
        map.set(ex.name, { name: ex.name, muscle: ex.agonist, rm });
      }
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.rm - a.rm)
    .slice(0, 6);
}
