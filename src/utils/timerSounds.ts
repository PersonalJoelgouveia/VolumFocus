/**
 * Sons do Timer de intervalos (Ferramentas > Timer) gerados 100% via Web
 * Audio API nativa (osciladores simples) — sem arquivos .mp3/.wav
 * embutidos nem nenhuma dependência de áudio nova, como pedido ("usar
 * recursos nativos/web compatíveis e evitar dependências desnecessárias").
 * Um único AudioContext compartilhado, criado sob demanda (lazy) — a
 * maioria dos navegadores exige um gesto do usuário antes de permitir
 * áudio, e o primeiro toque em "Testar" ou "Iniciar" já serve como esse
 * gesto.
 */

export type StartSoundId = 'start1' | 'start2';
export type EndSoundId = 'end1' | 'end2';
export type SoundId = StartSoundId | EndSoundId | 'tick';

interface Note {
  freq: number;
  duration: number;
  gap?: number;
}

const SOUND_PATTERNS: Record<SoundId, Note[]> = {
  start1: [{ freq: 880, duration: 0.16 }],
  start2: [
    { freq: 660, duration: 0.1, gap: 0.04 },
    { freq: 880, duration: 0.16 },
  ],
  end1: [{ freq: 440, duration: 0.22 }],
  end2: [
    { freq: 520, duration: 0.12, gap: 0.04 },
    { freq: 330, duration: 0.22 },
  ],
  tick: [{ freq: 1000, duration: 0.07 }],
};

export const START_SOUND_OPTIONS: { id: StartSoundId; label: string }[] = [
  { id: 'start1', label: 'Som de início 1' },
  { id: 'start2', label: 'Som de início 2' },
];

export const END_SOUND_OPTIONS: { id: EndSoundId; label: string }[] = [
  { id: 'end1', label: 'Som de final 1' },
  { id: 'end2', label: 'Som de final 2' },
];

let sharedCtx: AudioContext | null = null;

/** AudioContext compartilhado (criado sob demanda). `null` sem Web Audio API. */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

const getContext = getAudioContext;

let unlocked = false;

/**
 * Libera o áudio sob a política de autoplay (iOS/Android/desktop): precisa ser
 * chamado DENTRO de um gesto do usuário (toque/clique/tecla). Retoma o contexto
 * se estiver `suspended`/`interrupted` e toca 1 amostra muda uma única vez (o
 * "desbloqueio" que o iOS Safari exige). Idempotente e nunca lança erro.
 */
export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {
      /* só libera no próximo gesto do usuário */
    });
  }
  if (unlocked) return;
  try {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
    unlocked = true;
  } catch {
    /* tenta de novo no próximo gesto */
  }
}

/** Toca um som pré-definido (`SoundId`) no volume dado (0 a 1). Silencioso
 *  em navegadores sem Web Audio API — nunca lança erro. */
export function playSound(id: SoundId, volume: number) {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      /* alguns navegadores só liberam no próximo gesto do usuário */
    });
  }
  const vol = Math.min(1, Math.max(0, volume));
  let t = ctx.currentTime;
  for (const note of SOUND_PATTERNS[id]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + note.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + note.duration + 0.02);
    t += note.duration + (note.gap ?? 0.05);
  }
}
