import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));

import { WearableService, getWearableService, resetWearableService } from '../WearableService';
import { WebFallbackProvider } from '../WebFallbackProvider';
import type { WearableProvider } from '../WearableProvider';

describe('WearableService', () => {
  beforeEach(() => {
    resetWearableService();
  });

  it('usa WebFallbackProvider por padrão em qualquer plataforma (nenhuma API nativa ainda)', () => {
    const service = new WearableService('android');
    expect(service.getProvider()).toBeInstanceOf(WebFallbackProvider);
    expect(service.getProvider().platform).toBe('android');
  });

  it('guarda a plataforma recebida no construtor', () => {
    expect(new WearableService('ios').getPlatform()).toBe('ios');
  });

  it('registerProvider substitui o provider de uma plataforma específica', async () => {
    const service = new WearableService('ios');
    const fake: WearableProvider = {
      id: 'fake-native',
      platform: 'ios',
      isAvailable: vi.fn().mockResolvedValue(true),
      requestPermissions: vi.fn().mockResolvedValue(true),
      getHeartRate: vi.fn().mockResolvedValue([]),
      getSteps: vi.fn().mockResolvedValue([]),
      getDistance: vi.fn().mockResolvedValue([]),
      getCalories: vi.fn().mockResolvedValue([]),
      getSessions: vi.fn().mockResolvedValue([]),
      writeSession: vi.fn().mockResolvedValue(undefined),
    };

    service.registerProvider('ios', fake);

    expect(service.getProvider()).toBe(fake);
    await expect(service.getProvider().isAvailable()).resolves.toBe(true);
  });

  it('getWearableService() é um singleton cacheado por sessão', () => {
    const a = getWearableService();
    const b = getWearableService();
    expect(a).toBe(b);
  });

  it('resetWearableService() força a recriação do singleton', () => {
    const a = getWearableService();
    resetWearableService();
    const b = getWearableService();
    expect(a).not.toBe(b);
  });
});
