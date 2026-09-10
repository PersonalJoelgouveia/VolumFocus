export interface PatenteRank {
  tier: number;
  weeks: number;
  name: string;
  icon: string;
  color: string;
}

export type StreakId = 'tonnage' | 'consistencia' | 'volume' | 'cardio';

export interface StreakState {
  current: number;
  best: number;
}

export type RecordBadgeId = 'pace_ouro' | 'ultra_dist' | 'fornalha' | 'eficiencia' | 'tita_power';
export type RecordCategory = 'forca' | 'cardio' | 'misto';

export interface RecordBadgeDef {
  id: RecordBadgeId;
  name: string;
  desc: string;
  cat: RecordCategory;
  catLabel: string;
  unit: string;
  better: 'higher' | 'lower';
  icon: string;
  color: string;
  format: (v: number) => string;
}

export interface RecordEntry {
  value: number;
  date: string;
  label: string;
}

export interface FireState {
  current: number;
  best: number;
  lastDate: string | null;
}
