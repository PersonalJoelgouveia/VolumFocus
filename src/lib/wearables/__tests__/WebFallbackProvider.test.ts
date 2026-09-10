import { describe, expect, it } from 'vitest';
import { WebFallbackProvider } from '../WebFallbackProvider';

describe('WebFallbackProvider', () => {
  const range = { start: new Date('2026-01-01'), end: new Date('2026-01-02') };

  it('nunca reporta disponibilidade', async () => {
    const provider = new WebFallbackProvider();
    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('nunca concede permissões', async () => {
    const provider = new WebFallbackProvider();
    await expect(provider.requestPermissions(['heartRate', 'steps'])).resolves.toBe(false);
  });

  it('retorna listas vazias pra todos os tipos de dado', async () => {
    const provider = new WebFallbackProvider();
    await expect(provider.getHeartRate(range)).resolves.toEqual([]);
    await expect(provider.getSteps(range)).resolves.toEqual([]);
    await expect(provider.getDistance(range)).resolves.toEqual([]);
    await expect(provider.getCalories(range)).resolves.toEqual([]);
    await expect(provider.getSessions(range)).resolves.toEqual([]);
  });

  it('writeSession nunca lança, mesmo sem plataforma nativa', async () => {
    const provider = new WebFallbackProvider();
    await expect(
      provider.writeSession({ id: '1', start: range.start, end: range.end, activityType: 'strength' })
    ).resolves.toBeUndefined();
  });

  it('carrega a plataforma passada no construtor, default "web"', () => {
    expect(new WebFallbackProvider().platform).toBe('web');
    expect(new WebFallbackProvider('android').platform).toBe('android');
  });
});
