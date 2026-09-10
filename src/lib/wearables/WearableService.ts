/**
 * Orquestra qual WearableProvider está ativo. Nesta etapa só existe
 * WebFallbackProvider registrado — para Android/iOS o serviço cai no
 * mesmo fallback, deliberadamente (ver restrição: nenhuma API nativa
 * ainda). Numa etapa futura, os providers nativos reais são registrados
 * aqui via registerProvider(), sem mexer em mais nada — nem
 * useWearableStore, nem telas, precisam mudar.
 */

import type { PlatformId } from './models';
import type { WearableProvider } from './WearableProvider';
import { WebFallbackProvider } from './WebFallbackProvider';
import { HealthConnectProvider } from './HealthConnectProvider';
import { detectPlatform } from './platform';

export class WearableService {
  private providers = new Map<PlatformId, WearableProvider>();
  private readonly platform: PlatformId;

  constructor(platform: PlatformId) {
    this.platform = platform;
    // Fallback padrão pras 3 plataformas — providers nativos reais
    // substituem essas entradas em etapa futura via registerProvider().
    this.providers.set('web', new WebFallbackProvider('web'));
    this.providers.set('android', new WebFallbackProvider('android'));
    this.providers.set('ios', new WebFallbackProvider('ios'));
  }

  /** Substitui o provider de uma plataforma específica (usado pelos
   *  providers nativos reais, numa etapa futura, e por testes). */
  registerProvider(platform: PlatformId, provider: WearableProvider): void {
    this.providers.set(platform, provider);
  }

  getProvider(): WearableProvider {
    return this.providers.get(this.platform) ?? new WebFallbackProvider(this.platform);
  }

  getPlatform(): PlatformId {
    return this.platform;
  }
}

let singleton: WearableService | null = null;

/** Acesso padrão do resto do app — plataforma detectada uma vez, cacheada
 *  pela sessão do app. */
export function getWearableService(): WearableService {
  if (!singleton) {
    const platform = detectPlatform();
    singleton = new WearableService(platform);
    if (platform === 'android') {
      // Único ponto de wiring do provider real desta etapa — Web e iOS
      // seguem 100% no WebFallbackProvider, sem nenhuma mudança de
      // comportamento.
      singleton.registerProvider('android', new HealthConnectProvider());
    }
  }
  return singleton;
}

/** Só pra testes — força a recriação do singleton entre casos. */
export function resetWearableService(): void {
  singleton = null;
}
