import { useEffect } from 'react';
import { useTimerStore } from '../../store/useTimerStore';

/**
 * Componente sem renderização — só existe para manter um único
 * `setInterval` rodando enquanto o cronômetro estiver ativo, chamando
 * `tick()` a cada segundo. Sucessor de `croState.timerId =
 * setInterval(_croTick, 1000)` (index.html ~10050).
 *
 * Precisa ser montado uma única vez, num nível que não desmonta ao trocar
 * de view (ver AppShell) — assim o cronômetro continua "em segundo plano"
 * mesmo que o usuário navegue para outra tela, igual ao monolito.
 */
export function TimerEngine() {
  const isRunning = useTimerStore((s) => s.isRunning);
  const tick = useTimerStore((s) => s.tick);

  useEffect(() => {
    if (!isRunning) return;
    // O tempo é calculado por timestamp (startTs vs Date.now()) dentro do
    // tick(), então o intervalo só atualiza a tela. 250ms evita segundos
    // "pulados/repetidos" por jitter, e ao voltar para a aba/app o valor é
    // recalculado na hora (setInterval é atrasado/congelado em segundo plano).
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    tick();
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
  }, [isRunning, tick]);

  return null;
}
