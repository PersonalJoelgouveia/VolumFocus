import type { HistoricoSemana } from '../types/history';
import type { PatenteRank, RecordBadgeDef, StreakId } from '../types/achievement';

/**
 * Migrado fielmente do namespace `ach` (index.html ~7959-8231): mesma
 * escala de patentes, mesmas 4 insígnias de semanas consecutivas, mesmas
 * 5 conquistas de recorde pessoal (nomes/descrições/unidades/thresholds
 * idênticos).
 *
 * Duas simplificações deliberadas, disclosed:
 * 1. Ícones dos badges de recorde viraram emoji simples em vez do SVG
 *    multi-camada com círculo de destaque do original — consistente com
 *    o resto do app React (NovaSemanaView, ClientesView já usam emoji).
 * 2. O pop-up de celebração com confete (#ach-popup) virou toast — o app
 *    já usa toast como afordance de "conquista/celebração" em vários
 *    pontos (série concluída, semana arquivada); não duplica um segundo
 *    padrão de celebração.
 */

export const RANKS: PatenteRank[] = [
  { tier: 1, weeks: 2, name: 'Recruta', icon: '🔰', color: '#8d99ae' },
  { tier: 2, weeks: 4, name: 'Soldado', icon: '🥉', color: '#cd7f32' },
  { tier: 3, weeks: 6, name: 'Sargento', icon: '🥈', color: '#c0c0c0' },
  { tier: 4, weeks: 9, name: 'Tenente', icon: '🥇', color: '#ffd700' },
  { tier: 5, weeks: 12, name: 'Capitão', icon: '🎖️', color: '#00c4b3' },
  { tier: 6, weeks: 16, name: 'Major', icon: '⭐', color: '#a78bfa' },
  { tier: 7, weeks: 20, name: 'Coronel', icon: '🌟', color: '#ff9640' },
  { tier: 8, weeks: 26, name: 'General', icon: '👑', color: '#FFD700' },
];

export function getRank(weeks: number): PatenteRank | null {
  let r: PatenteRank | null = null;
  for (const t of RANKS) if (weeks >= t.weeks) r = t;
  return r;
}

export function getNextRank(weeks: number): PatenteRank | null {
  return RANKS.find((t) => weeks < t.weeks) ?? null;
}

export interface StreakDef {
  id: StreakId;
  name: string;
  desc: string;
  baseIcon: string;
  metric: (snap: HistoricoSemana | null) => number;
  continues: (val: number, prevVal: number | null) => boolean;
}

export const STREAKS: StreakDef[] = [
  {
    id: 'tonnage',
    name: 'Sobrecarga Progressiva',
    desc: 'Semanas consecutivas com tonelagem total (kg) crescente.',
    baseIcon: '🏋️',
    metric: (snap) => (snap ? snap.tonnage : 0),
    continues: (val, prevVal) => val > 0 && (prevVal === null || val > prevVal),
  },
  {
    id: 'consistencia',
    name: 'Guerreiro da Rotina',
    desc: 'Semanas consecutivas com 3 ou mais treinos registrados.',
    baseIcon: '🗓️',
    metric: (snap) => (snap ? snap.treinos : 0),
    continues: (val) => val >= 3,
  },
  {
    id: 'volume',
    name: 'Máquina de Volume',
    desc: 'Semanas consecutivas com volume total de séries crescente.',
    baseIcon: '📈',
    metric: (snap) => (snap ? snap.sets : 0),
    continues: (val, prevVal) => val > 0 && (prevVal === null || val > prevVal),
  },
  {
    id: 'cardio',
    name: 'Motor Aeróbico',
    desc: 'Semanas consecutivas com cardio registrado.',
    baseIcon: '🏃',
    metric: (snap) => (snap ? snap.cardio.totalMin : 0),
    continues: (val) => val > 0,
  },
];

export const RECORD_BADGES: RecordBadgeDef[] = [
  {
    id: 'pace_ouro',
    name: 'Pace de Ouro',
    desc: 'Melhor pace (ritmo/km) em uma atividade de corrida.',
    cat: 'cardio',
    catLabel: '🏃 Cardio',
    unit: 'min/km',
    better: 'lower',
    icon: '🏃',
    color: '#00c4b3',
    format: (v) => `${v.toFixed(2)} min/km`,
  },
  {
    id: 'ultra_dist',
    name: 'Ultra Resistência',
    desc: 'Maior distância percorrida em uma única atividade.',
    cat: 'cardio',
    catLabel: '🏃 Cardio',
    unit: 'km',
    better: 'higher',
    icon: '🛣️',
    color: '#22d3a0',
    format: (v) => `${v.toFixed(2)} km`,
  },
  {
    id: 'fornalha',
    name: 'Fornalha Calórica',
    desc: 'Maior gasto calórico (kcal) em uma única sessão de treino.',
    cat: 'misto',
    catLabel: '🔥 Misto',
    unit: 'kcal',
    better: 'higher',
    icon: '🔥',
    color: '#ff9640',
    format: (v) => `${v.toFixed(0)} kcal`,
  },
  {
    id: 'eficiencia',
    name: 'Eficiência Aeróbica',
    desc: 'Mesmo pace anterior com FC média menor — evolução cardiovascular real.',
    cat: 'cardio',
    catLabel: '🏃 Cardio',
    unit: 'bpm',
    better: 'lower',
    icon: '❤️',
    color: '#a78bfa',
    format: (v) => `${v.toFixed(0)} bpm`,
  },
  {
    id: 'tita_power',
    name: 'Titã do Powerlifting',
    desc: 'Maior carga absoluta em Supino Reto, Terra ou Agachamento.',
    cat: 'forca',
    catLabel: '💪 Força',
    unit: 'kg',
    better: 'higher',
    icon: '🏋️',
    color: '#00c4b3',
    format: (v) => `${v.toFixed(1)} kg`,
  },
];

/** Nomes-base que contam para "Titã do Powerlifting" — migrado de targetNames. */
export const TITA_TARGET_NAMES = ['Supino Reto', 'Levantamento Terra', 'Agachamento Livre', 'Agachamento Barra', 'Terra Convencional'];

export const FIRE_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];
