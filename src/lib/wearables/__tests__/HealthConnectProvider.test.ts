import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capgo/capacitor-health', () => ({
  Health: {
    isAvailable: vi.fn(),
    requestAuthorization: vi.fn(),
    checkAuthorization: vi.fn(),
    readSamples: vi.fn(),
    saveSample: vi.fn(),
    queryWorkouts: vi.fn(),
    queryAggregated: vi.fn(),
  },
}));

import { Health } from '@capgo/capacitor-health';
import { HealthConnectProvider } from '../HealthConnectProvider';

const range = { start: new Date('2026-01-01'), end: new Date('2026-01-02') };

describe('HealthConnectProvider', () => {
  let provider: HealthConnectProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new HealthConnectProvider();
  });

  describe('isAvailable', () => {
    it('reflete o resultado real do plugin', async () => {
      vi.mocked(Health.isAvailable).mockResolvedValue({ available: true, platform: 'android' });
      await expect(provider.isAvailable()).resolves.toBe(true);
    });

    it('retorna false quando Health Connect não está instalado/disponível', async () => {
      vi.mocked(Health.isAvailable).mockResolvedValue({ available: false, reason: 'not_installed' });
      await expect(provider.isAvailable()).resolves.toBe(false);
    });

    it('nunca lança — erro nativo vira false', async () => {
      vi.mocked(Health.isAvailable).mockRejectedValue(new Error('bridge indisponível'));
      await expect(provider.isAvailable()).resolves.toBe(false);
    });
  });

  describe('requestPermissions', () => {
    it('nem chega a pedir permissão se Health Connect está indisponível', async () => {
      vi.mocked(Health.isAvailable).mockResolvedValue({ available: false });
      const granted = await provider.requestPermissions(['steps']);
      expect(granted).toBe(false);
      expect(Health.requestAuthorization).not.toHaveBeenCalled();
    });

    it('true quando pelo menos um escopo pedido é concedido (granular)', async () => {
      vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
      vi.mocked(Health.requestAuthorization).mockResolvedValue({
        readAuthorized: ['steps'],
        readDenied: ['heartRate'],
        writeAuthorized: [],
        writeDenied: [],
      });
      const granted = await provider.requestPermissions(['steps', 'heartRate']);
      expect(granted).toBe(true);
      expect(Health.requestAuthorization).toHaveBeenCalledWith({ read: ['steps', 'heartRate'], write: [] });
    });

    it('false quando o usuário nega todos os escopos pedidos', async () => {
      vi.mocked(Health.isAvailable).mockResolvedValue({ available: true });
      vi.mocked(Health.requestAuthorization).mockResolvedValue({
        readAuthorized: [],
        readDenied: ['steps'],
        writeAuthorized: [],
        writeDenied: [],
      });
      await expect(provider.requestPermissions(['steps'])).resolves.toBe(false);
    });
  });

  describe('leitura de dados — respeita permissão granular por tipo', () => {
    it('getSteps retorna [] sem chamar o nativo quando o escopo "steps" está negado', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: [],
        readDenied: ['steps'],
        writeAuthorized: [],
        writeDenied: [],
      });
      await expect(provider.getSteps(range)).resolves.toEqual([]);
      expect(Health.queryAggregated).not.toHaveBeenCalled();
    });

    it('getSteps normaliza AggregatedSample[] em StepSample[] quando autorizado', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: ['steps'],
        readDenied: [],
        writeAuthorized: [],
        writeDenied: [],
      });
      vi.mocked(Health.queryAggregated).mockResolvedValue({
        samples: [{ startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:00Z', value: 8342, values: { sum: 8342 }, unit: 'count' }],
      });
      await expect(provider.getSteps(range)).resolves.toEqual([{ date: '2026-01-01', steps: 8342 }]);
    });

    it('getHeartRate normaliza HealthSample[] em HeartRateSample[]', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: ['heartRate'],
        readDenied: [],
        writeAuthorized: [],
        writeDenied: [],
      });
      vi.mocked(Health.readSamples).mockResolvedValue({
        samples: [{ dataType: 'heartRate', startDate: '2026-01-01T10:00:00Z', endDate: '2026-01-01T10:00:00Z', value: 72, unit: 'bpm' }],
      });
      await expect(provider.getHeartRate(range)).resolves.toEqual([{ timestamp: '2026-01-01T10:00:00Z', bpm: 72 }]);
    });

    it('getRestingHeartRate usa o dataType correto e retorna [] quando negado', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: [],
        readDenied: ['restingHeartRate'],
        writeAuthorized: [],
        writeDenied: [],
      });
      await expect(provider.getRestingHeartRate(range)).resolves.toEqual([]);
    });

    it('lida com ausência de dado (nativo retorna lista vazia) sem lançar', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: ['distance'],
        readDenied: [],
        writeAuthorized: [],
        writeDenied: [],
      });
      vi.mocked(Health.queryAggregated).mockResolvedValue({ samples: [] });
      await expect(provider.getDistance(range)).resolves.toEqual([]);
    });

    it('nunca lança quando a chamada nativa falha — retorna []', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: ['calories'],
        readDenied: [],
        writeAuthorized: [],
        writeDenied: [],
      });
      vi.mocked(Health.queryAggregated).mockRejectedValue(new Error('falha nativa'));
      await expect(provider.getCalories(range)).resolves.toEqual([]);
    });
  });

  describe('getSessions', () => {
    it('normaliza Workout[] em WearableWorkoutSession[]', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: ['workouts'],
        readDenied: [],
        writeAuthorized: [],
        writeDenied: [],
      });
      vi.mocked(Health.queryWorkouts).mockResolvedValue({
        workouts: [
          {
            workoutType: 'strengthTraining',
            duration: 3600,
            totalEnergyBurned: 420,
            startDate: '2026-01-01T08:00:00Z',
            endDate: '2026-01-01T09:00:00Z',
            platformId: 'hc-123',
          },
        ],
      });
      const result = await provider.getSessions(range);
      expect(result).toEqual([
        {
          id: 'hc-123',
          start: new Date('2026-01-01T08:00:00Z'),
          end: new Date('2026-01-01T09:00:00Z'),
          activityType: 'strengthTraining',
          calories: 420,
        },
      ]);
    });
  });

  describe('writeSession', () => {
    it('não chama o nativo quando a sessão não tem calorias', async () => {
      await provider.writeSession({ id: '1', start: range.start, end: range.end, activityType: 'strength' });
      expect(Health.saveSample).not.toHaveBeenCalled();
    });

    it('grava via saveSample quando autorizado e com calorias', async () => {
      vi.mocked(Health.checkAuthorization).mockResolvedValue({
        readAuthorized: ['workouts'],
        readDenied: [],
        writeAuthorized: [],
        writeDenied: [],
      });
      await provider.writeSession({ id: '1', start: range.start, end: range.end, activityType: 'strength', calories: 300 });
      expect(Health.saveSample).toHaveBeenCalledWith({
        dataType: 'calories',
        value: 300,
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
      });
    });
  });
});
