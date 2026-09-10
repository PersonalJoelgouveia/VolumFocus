import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn() },
}));

import { Capacitor } from '@capacitor/core';
import { detectPlatform } from '../platform';

describe('detectPlatform', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.each(['android', 'ios', 'web'] as const)('repassa "%s" direto do Capacitor.getPlatform()', (platform) => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
    expect(detectPlatform()).toBe(platform);
  });

  it('cai em "web" se Capacitor.getPlatform() lançar', () => {
    vi.mocked(Capacitor.getPlatform).mockImplementation(() => {
      throw new Error('runtime indisponível');
    });
    expect(detectPlatform()).toBe('web');
  });
});
