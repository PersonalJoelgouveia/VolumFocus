import { getAudioContext } from './timerSounds';

/**
 * Alarme do timer de descanso (ExecutionModal), 100% Web Audio API.
 *
 * Os bipes são AGENDADOS no relógio do próprio AudioContext (`ctx.currentTime`)
 * no momento em que o descanso começa — e não disparados por setInterval/
 * setTimeout. Assim o som sai na hora certa mesmo que o navegador atrase ou
 * congele os timers JS com a aba em segundo plano. (Em iOS o sistema pode
 * suspender o contexto com a tela bloqueada; aí vale o fallback: ao voltar ao
 * app, o ExecutionModal detecta o fim por timestamp e toca o alarme na hora.)
 */

const BURST_BEEPS = 3;
const BEEP_SEC = 0.13;
const BEEP_GAP_SEC = 0.09;
const BURST_PERIOD_SEC = 1.5;
const BURST_COUNT = 16; // ≈ 24s de alarme, até o usuário tocar para parar
const FREQ_HZ = 988;

interface Scheduled {
  nodes: OscillatorNode[];
  gain: GainNode;
  /** Instante (relógio do ctx) em que o primeiro bipe começa. */
  startsAt: number;
  /** Instante (relógio do ctx) em que o último bipe termina. */
  endsAt: number;
}

let current: Scheduled | null = null;

/** Para e descarta qualquer alarme agendado/tocando. Nunca lança erro. */
export function cancelAlarm(): void {
  const s = current;
  current = null;
  if (!s) return;
  for (const osc of s.nodes) {
    try {
      osc.stop();
    } catch {
      /* já parado */
    }
    try {
      osc.disconnect();
    } catch {
      /* já desconectado */
    }
  }
  try {
    s.gain.disconnect();
  } catch {
    /* já desconectado */
  }
}

/**
 * Agenda o alarme para daqui a `delayMs`. Substitui qualquer agendamento
 * anterior. `volume` de 0 a 1. Retorna `false` se não houver Web Audio.
 */
export function scheduleAlarm(delayMs: number, volume: number): boolean {
  cancelAlarm();
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {
      /* sem gesto liberado ainda — o fallback ao voltar ao app cobre */
    });
  }
  const vol = Math.min(1, Math.max(0, volume));
  const gain = ctx.createGain();
  gain.gain.value = vol;
  gain.connect(ctx.destination);

  const start = ctx.currentTime + Math.max(0, delayMs) / 1000;
  const nodes: OscillatorNode[] = [];
  let endsAt = start;

  for (let b = 0; b < BURST_COUNT; b++) {
    const burstStart = start + b * BURST_PERIOD_SEC;
    for (let i = 0; i < BURST_BEEPS; i++) {
      const t = burstStart + i * (BEEP_SEC + BEEP_GAP_SEC);
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(FREQ_HZ, t);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.5, t + 0.01);
      env.gain.setValueAtTime(0.5, t + BEEP_SEC - 0.02);
      env.gain.linearRampToValueAtTime(0, t + BEEP_SEC);
      osc.connect(env).connect(gain);
      osc.start(t);
      osc.stop(t + BEEP_SEC + 0.02);
      nodes.push(osc);
      endsAt = t + BEEP_SEC + 0.02;
    }
  }

  current = { nodes, gain, startsAt: start, endsAt };
  return true;
}

/**
 * Garante que o alarme esteja tocando AGORA. Só deixa o agendado em paz se ele
 * já começou e ainda não terminou no relógio do contexto. Se ainda não começou
 * (contexto suspenso em segundo plano — o relógio dele para), ou já terminou,
 * dispara um novo imediatamente.
 */
export function ensureAlarmRinging(volume: number): void {
  const ctx = getAudioContext();
  if (ctx && current && ctx.state === 'running') {
    const t = ctx.currentTime;
    if (t >= current.startsAt - 0.05 && t < current.endsAt) return;
  }
  scheduleAlarm(0, volume);
}
