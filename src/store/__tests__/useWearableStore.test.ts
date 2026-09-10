import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProvider = {
  isAvailable: vi.fn(),
  requestPermissions: vi.fn(),
  getHeartRate: vi.fn(),
  getSteps: vi.fn(),
  getDistance: vi.fn(),
  getCalories: vi.fn(),
  getSessions: vi.fn(),
  writeSession: vi.fn(),
};

vi.mock('../../lib/wearables', () => ({
  getWearableService: () => ({
    getPlatform: () => 'web',
    getProvider: () => mockProvider,
  }),
}));

import { useWearableStore } from '../useWearableStore';

describe('useWearableStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWearableStore.setState({
      platform: 'web',
      available: false,
      permissionsGranted: false,
      status: 'idle',
      lastSyncAt: null,
      errorMessage: null,
    });
  });

  it('checkAvailability reflete o retorno do provider e marca status "ok"', async () => {
    mockProvider.isAvailable.mockResolvedValue(true);
    await useWearableStore.getState().checkAvailability();
    expect(useWearableStore.getState().available).toBe(true);
    expect(useWearableStore.getState().status).toBe('ok');
  });

  it('checkAvailability marca status "error" se o provider lançar', async () => {
    mockProvider.isAvailable.mockRejectedValue(new Error('falhou'));
    await useWearableStore.getState().checkAvailability();
    expect(useWearableStore.getState().status).toBe('error');
    expect(useWearableStore.getState().errorMessage).toBe('falhou');
  });

  it('requestPermissions atualiza permissionsGranted e lastSyncAt quando concedido', async () => {
    mockProvider.requestPermissions.mockResolvedValue(true);
    const granted = await useWearableStore.getState().requestPermissions(['heartRate']);
    expect(granted).toBe(true);
    expect(useWearableStore.getState().permissionsGranted).toBe(true);
    expect(useWearableStore.getState().lastSyncAt).not.toBeNull();
  });

  it('requestPermissions não mexe em lastSyncAt quando negado', async () => {
    mockProvider.requestPermissions.mockResolvedValue(false);
    await useWearableStore.getState().requestPermissions(['steps']);
    expect(useWearableStore.getState().permissionsGranted).toBe(false);
    expect(useWearableStore.getState().lastSyncAt).toBeNull();
  });

  it('fetchSteps repassa o range e retorna o que o provider devolver, sem guardar na store', async () => {
    const range = { start: new Date('2026-01-01'), end: new Date('2026-01-02') };
    mockProvider.getSteps.mockResolvedValue([{ date: '2026-01-01', steps: 1000 }]);

    const result = await useWearableStore.getState().fetchSteps(range);

    expect(mockProvider.getSteps).toHaveBeenCalledWith(range);
    expect(result).toEqual([{ date: '2026-01-01', steps: 1000 }]);
    expect(useWearableStore.getState()).not.toHaveProperty('steps');
  });
});
