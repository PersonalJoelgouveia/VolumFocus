import { useEffect } from 'react';

/**
 * Mantém a tela acordada (Screen Wake Lock API) enquanto `active` for true.
 * No celular, tela bloqueada = JS congelado e timers/áudio parados; o wake lock
 * evita isso durante o descanso. O navegador libera o lock sozinho ao esconder
 * a aba, então ele é pedido de novo quando a página volta a ficar visível.
 * Sem suporte (ou negado) vira no-op silencioso.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (cancelled || document.visibilityState !== 'visible' || sentinel) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          s.release().catch(() => {});
          return;
        }
        sentinel = s;
        s.addEventListener('release', () => {
          if (sentinel === s) sentinel = null;
        });
      } catch {
        /* negado (economia de bateria etc.) — segue sem wake lock */
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const s = sentinel;
      sentinel = null;
      s?.release().catch(() => {});
    };
  }, [active]);
}
