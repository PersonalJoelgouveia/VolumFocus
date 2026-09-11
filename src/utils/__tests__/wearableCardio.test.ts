import { describe, expect, it } from 'vitest';
import {
  bucketTimeInZones,
  cardioActivityLabel,
  currentWeekRange,
  dayIndexOfDate,
  isCardioActivityType,
  markDuplicates,
} from '../wearableCardio';
import type { CardioZone } from '../../types/cardioTest';

describe('isCardioActivityType', () => {
  it.each(['running', 'Walking', 'CYCLING', 'swimming_pool', 'rowing_machine', 'hiit', 'hiking'])(
    'classifica "%s" como cardio',
    (t) => {
      expect(isCardioActivityType(t)).toBe(true);
    }
  );

  it.each(['strength_training', 'traditional_strength_training', 'yoga', 'pilates', 'weightlifting'])(
    'NÃO classifica "%s" como cardio',
    (t) => {
      expect(isCardioActivityType(t)).toBe(false);
    }
  );

  it('prioriza palavra não-cardio mesmo se um termo cardio aparecer junto', () => {
    expect(isCardioActivityType('strength_interval_training')).toBe(false);
  });
});

describe('cardioActivityLabel', () => {
  it('traduz tipos conhecidos pro rótulo em pt-BR', () => {
    expect(cardioActivityLabel('running')).toBe('Corrida');
    expect(cardioActivityLabel('cycling')).toBe('Ciclismo');
  });

  it('cai em "Cardio" genérico pra tipo desconhecido', () => {
    expect(cardioActivityLabel('some_weird_type')).toBe('Cardio');
  });
});

describe('dayIndexOfDate', () => {
  it('mapeia Segunda para 0 e Domingo para 6', () => {
    expect(dayIndexOfDate(new Date('2026-09-07T10:00:00'))).toBe(0); // segunda
    expect(dayIndexOfDate(new Date('2026-09-13T10:00:00'))).toBe(6); // domingo
  });
});

describe('currentWeekRange', () => {
  it('retorna segunda 00:00 até domingo 23:59:59.999 da semana de `now`', () => {
    const now = new Date('2026-09-10T15:30:00'); // quinta
    const { start, end } = currentWeekRange(now);
    expect(dayIndexOfDate(start)).toBe(0);
    expect(start.getHours()).toBe(0);
    expect(dayIndexOfDate(end)).toBe(6);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('bucketTimeInZones', () => {
  const zones: CardioZone[] = [
    { key: 'z1', name: 'Z1 · Recuperação', desc: '', min: 0.5, max: 0.6, cls: 'cardio-z1', bpmMin: 100, bpmMax: 120 },
    { key: 'z2', name: 'Z2 · Lipolítica', desc: '', min: 0.6, max: 0.7, cls: 'cardio-z2', bpmMin: 121, bpmMax: 140 },
    { key: 'z3', name: 'Z3 · Aeróbia', desc: '', min: 0.7, max: 0.8, cls: 'cardio-z3', bpmMin: 141, bpmMax: 160 },
  ];

  it('retorna null com menos de 2 amostras', () => {
    expect(bucketTimeInZones([{ timestamp: '2026-09-10T10:00:00.000Z', bpm: 130 }], zones)).toBeNull();
  });

  it('distribui minutos entre zonas conforme a FC média de cada par de amostras', () => {
    const samples = [
      { timestamp: '2026-09-10T10:00:00.000Z', bpm: 110 }, // z1
      { timestamp: '2026-09-10T10:02:00.000Z', bpm: 110 }, // par 1: média 110 → z1, 2min
      { timestamp: '2026-09-10T10:04:00.000Z', bpm: 150 }, // par 2: média 130 → z2, 2min
    ];
    const result = bucketTimeInZones(samples, zones)!;
    expect(result.find((z) => z.key === 'z1')?.minutes).toBe(2);
    expect(result.find((z) => z.key === 'z2')?.minutes).toBe(2);
    expect(result.find((z) => z.key === 'z3')?.minutes).toBe(0);
  });

  it('joga amostra acima de todas as faixas na última zona', () => {
    const samples = [
      { timestamp: '2026-09-10T10:00:00.000Z', bpm: 180 },
      { timestamp: '2026-09-10T10:01:00.000Z', bpm: 180 },
    ];
    const result = bucketTimeInZones(samples, zones)!;
    expect(result.find((z) => z.key === 'z3')?.minutes).toBe(1);
  });

  it('limita o gap entre amostras esparsas (GAP_CAP_MIN)', () => {
    const samples = [
      { timestamp: '2026-09-10T10:00:00.000Z', bpm: 110 },
      { timestamp: '2026-09-10T10:30:00.000Z', bpm: 110 }, // 30min de buraco
    ];
    const result = bucketTimeInZones(samples, zones)!;
    expect(result.find((z) => z.key === 'z1')?.minutes).toBeLessThanOrEqual(3);
  });
});

describe('markDuplicates', () => {
  const base = {
    id: 'w1',
    dayIndex: 0 as const,
    start: new Date('2026-09-07T07:00:00'),
    activityType: 'running',
    label: 'Corrida',
    avgHr: null,
    maxHr: null,
    calories: null,
    zoneTimes: null,
  };

  it('marca como duplicata quando a duração bate com um registro manual do mesmo dia', () => {
    const [result] = markDuplicates([{ ...base, durationMin: 30 }], { 0: [28] });
    expect(result.isDuplicate).toBe(true);
  });

  it('não marca como duplicata se a duração for muito diferente', () => {
    const [result] = markDuplicates([{ ...base, durationMin: 60 }], { 0: [15] });
    expect(result.isDuplicate).toBe(false);
  });

  it('não marca como duplicata se não há registro manual naquele dia', () => {
    const [result] = markDuplicates([{ ...base, durationMin: 30 }], { 1: [30] });
    expect(result.isDuplicate).toBe(false);
  });
});
