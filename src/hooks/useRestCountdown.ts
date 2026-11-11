import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_DURATION = 10;
const MAX_DURATION = 600;

/** Segundos inteiros até `endAt` (arredonda para cima: 1,2s → 2). */
function secondsLeft(endAt: number): number {
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

export interface RestCountdown {
  duration: number;
  remaining: number;
  running: boolean;
  /** true do fim do descanso até a pessoa agir (concluir série / pular). */
  ringing: boolean;
  start: (seconds?: number) => void;
  /** Pausa se estiver rodando; retoma se estiver pausado; inicia se estiver parado. */
  toggle: () => void;
  /** Para tudo e volta ao tempo cheio. */
  reset: () => void;
  stopRing: () => void;
  adjust: (delta: number) => void;
}

/**
 * Contagem regressiva do descanso, por TIMESTAMP: o fim é um instante absoluto
 * (`endAt`) e cada tick só recalcula `endAt - Date.now()`. Por isso o tempo
 * continua correto mesmo que o navegador atrase/congele o setInterval com a aba
 * em segundo plano — ao voltar (visibilitychange/pageshow/focus) recalcula na hora.
 */
export function useRestCountdown(initialDuration: number, onFinish: () => void): RestCountdown {
  const [duration, setDuration] = useState(initialDuration);
  const [remaining, setRemaining] = useState(initialDuration);
  const [running, setRunning] = useState(false);
  const [ringing, setRinging] = useState(false);

  const endAtRef = useRef<number | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const tick = useCallback(() => {
    const endAt = endAtRef.current;
    if (endAt === null) return;
    const left = secondsLeft(endAt);
    if (left <= 0) {
      endAtRef.current = null;
      setRemaining(0);
      setRunning(false);
      setRinging(true);
      onFinishRef.current();
      return;
    }
    setRemaining((prev) => (prev === left ? prev : left));
  }, []);

  useEffect(() => {
    if (!running) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', tick);
      window.removeEventListener('focus', tick);
    };
  }, [running, tick]);

  const start = useCallback(
    (seconds?: number) => {
      const d = seconds ?? duration;
      endAtRef.current = Date.now() + d * 1000;
      setRemaining(d);
      setRunning(true);
      setRinging(false);
    },
    [duration]
  );

  const toggle = useCallback(() => {
    if (running) {
      const endAt = endAtRef.current;
      setRemaining(endAt === null ? remaining : secondsLeft(endAt));
      endAtRef.current = null;
      setRunning(false);
      return;
    }
    if (ringing || remaining <= 0) {
      start();
      return;
    }
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }, [running, ringing, remaining, start]);

  const reset = useCallback(() => {
    endAtRef.current = null;
    setRunning(false);
    setRinging(false);
    setRemaining(duration);
  }, [duration]);

  const stopRing = useCallback(() => setRinging(false), []);

  const adjust = useCallback(
    (delta: number) => {
      const next = Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration + delta));
      const applied = next - duration;
      setDuration(next);
      const endAt = endAtRef.current;
      if (running && endAt !== null) {
        const shifted = endAt + applied * 1000;
        endAtRef.current = shifted;
        setRemaining(Math.max(0, Math.min(next, secondsLeft(shifted))));
      } else if (!ringing) {
        setRemaining((r) => Math.max(0, Math.min(next, r + applied)));
      }
    },
    [duration, running, ringing]
  );

  return { duration, remaining, running, ringing, start, toggle, reset, stopRing, adjust };
}
