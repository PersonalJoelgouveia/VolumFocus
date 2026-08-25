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
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  return null;
}
