/**
 * Único ponto de contato com @capacitor/core nesta etapa — e mesmo assim
 * só o núcleo genérico de detecção de plataforma, não nenhuma API de
 * saúde. Capacitor.getPlatform() já retorna exatamente 'ios' | 'android'
 * | 'web', então não há tradução de enum nenhuma a fazer.
 */

import { Capacitor } from '@capacitor/core';
import type { PlatformId } from './models';

export function detectPlatform(): PlatformId {
  try {
    return Capacitor.getPlatform() as PlatformId;
  } catch {
    // Ambiente sem o runtime do Capacitor presente (ex: teste unitário
    // rodando fora de qualquer contexto) — Web é o fallback seguro.
    return 'web';
  }
}
