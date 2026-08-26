import type { MuscleGroup } from '../types/exercise';
import type { TrainingLevel } from '../types/workout';

/** Migrado de LEVEL_GOALS (index.html ~4075). */
export const LEVEL_GOALS: Record<TrainingLevel, { min: number; max: number; label: string; icon: string }> = {
  iniciante: { min: 10, max: 15, label: 'Iniciante', icon: '🌱' },
  intermediario: { min: 15, max: 20, label: 'Intermediário', icon: '⚡' },
  avancado: { min: 20, max: 25, label: 'Avançado', icon: '🔥' },
};

/** Migrado de UPPER/LOWER e VOL_MAX_UPPER/VOL_MAX_LOWER (index.html ~4070-4072). */
export const UPPER: MuscleGroup[] = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps'];
export const LOWER: MuscleGroup[] = ['Quadríceps', 'Isquiotibiais', 'Glúteos', 'Panturrilhas'];
export const VOL_MAX_UPPER = 30;
export const VOL_MAX_LOWER = 50;

export interface MusclePair {
  label: string;
  ag: { muscles: MuscleGroup[]; color: string };
  ant: { muscles: MuscleGroup[]; color: string };
  safe: [number, number];
  tip: string;
}

/** Migrado de PAIRS (index.html ~4086). */
export const PAIRS: MusclePair[] = [
  {
    label: 'Peitoral × Costas',
    ag: { muscles: ['Peito'], color: '#ff4d6d' },
    ant: { muscles: ['Costas'], color: '#38bdf8' },
    safe: [0.6, 1.4],
    tip: 'Manter os dois grupos com volumes próximos favorece a saúde dos ombros.',
  },
  {
    label: 'Quadríceps × Isquiotibiais',
    ag: { muscles: ['Quadríceps'], color: '#fbbf24' },
    ant: { muscles: ['Isquiotibiais'], color: '#fb923c' },
    safe: [1.0, 1.8],
    tip: 'Uma razão próxima de 1.3:1 é uma referência comum para a saúde dos joelhos.',
  },
  {
    label: 'Bíceps × Tríceps',
    ag: { muscles: ['Bíceps'], color: '#34d399' },
    ant: { muscles: ['Tríceps'], color: '#f87171' },
    safe: [0.7, 1.3],
    tip: 'Uma razão próxima de 1:1 é uma referência comum entre os flexores e extensores do cotovelo.',
  },
  {
    label: 'Glúteos × Extensores da Coluna',
    ag: { muscles: ['Glúteos'], color: '#f472b6' },
    ant: { muscles: ['Extensores da Coluna'], color: '#86efac' },
    safe: [0.5, 2.0],
    tip: 'Esses grupos trabalham juntos na estabilidade lombopélvica.',
  },
];

export interface TonnageComparison {
  th: number;
  emoji: string;
  text: string;
}

/** Migrado de COMPARISONS (index.html ~4097). */
export const COMPARISONS: TonnageComparison[] = [
  { th: 300, emoji: '🏠', text: 'uma geladeira industrial' },
  { th: 800, emoji: '🐻', text: 'um urso pardo adulto' },
  { th: 1500, emoji: '🐎', text: 'um cavalo de corrida' },
  { th: 3000, emoji: '🚗', text: 'um carro popular (Polo/HB20)' },
  { th: 4500, emoji: '🦛', text: 'um hipopótamo adulto' },
  { th: 6500, emoji: '🐘', text: 'um elefante africano adulto' },
  { th: 9000, emoji: '🚛', text: 'um caminhão toco carregado' },
  { th: 14000, emoji: '🚂', text: 'um vagão de metrô' },
  { th: 22000, emoji: '🚢', text: 'um iate de médio porte' },
];
