import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EndSoundId, StartSoundId } from '../utils/timerSounds';

/**
 * Configurações de áudio/vibração da tela Ferramentas > Timer — mesmo
 * padrão de persistência local do useThemeStore (jg3_*, fora do backup em
 * nuvem, por ser preferência do dispositivo). Isolado de
 * useIntervalTimerStore (protocolo/sequência) e de useTimerStore
 * (cronômetro de treino, que já tem sua própria lógica de som/alarme em
 * MetWeightModal/TimerConfirmModal, não tocada aqui).
 */
interface TimerAudioState {
  /** Toca ao iniciar um estímulo que não seja Descanso (Preparação/Exercício/Outro). */
  startEnabled: boolean;
  startSound: StartSoundId;
  /** Toca ao iniciar um estímulo do tipo Descanso (marca o fim do estímulo anterior). */
  endEnabled: boolean;
  endSound: EndSoundId;
  /** 0 a 1. */
  volume: number;
  vibrationEnabled: boolean;
  /** Bipe nos últimos 3s de cada estímulo. */
  finalCountdownEnabled: boolean;

  setStartEnabled: (v: boolean) => void;
  setStartSound: (id: StartSoundId) => void;
  setEndEnabled: (v: boolean) => void;
  setEndSound: (id: EndSoundId) => void;
  setVolume: (v: number) => void;
  setVibrationEnabled: (v: boolean) => void;
  setFinalCountdownEnabled: (v: boolean) => void;
}

export const useTimerAudioStore = create<TimerAudioState>()(
  persist(
    (set) => ({
      startEnabled: true,
      startSound: 'start1',
      endEnabled: true,
      endSound: 'end1',
      volume: 0.8,
      vibrationEnabled: true,
      finalCountdownEnabled: false,

      setStartEnabled: (v) => set({ startEnabled: v }),
      setStartSound: (id) => set({ startSound: id }),
      setEndEnabled: (v) => set({ endEnabled: v }),
      setEndSound: (id) => set({ endSound: id }),
      setVolume: (v) => set({ volume: v }),
      setVibrationEnabled: (v) => set({ vibrationEnabled: v }),
      setFinalCountdownEnabled: (v) => set({ finalCountdownEnabled: v }),
    }),
    { name: 'jg3_timer_audio_settings' },
  ),
);
