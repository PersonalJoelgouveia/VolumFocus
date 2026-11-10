import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useExecStore } from '../useExecStore';

function openStore() {
  useExecStore.getState().open(0, 0, { isCardio: false, totalSets: 3 });
}

describe('useExecStore — timer de descanso por timestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    openStore();
  });
  afterEach(() => {
    useExecStore.getState().close();
    vi.useRealTimers();
  });

  it('um único tick atrasado recupera todo o tempo decorrido (aba em segundo plano)', () => {
    const s = useExecStore.getState();
    s.setPreset(60);
    s.startTimer();
    vi.setSystemTime(Date.now() + 45_000); // 45s sem nenhum tick
    useExecStore.getState().tick();
    expect(useExecStore.getState().remaining).toBe(15);
    expect(useExecStore.getState().running).toBe(true);
  });

  it('termina e liga o alarme mesmo se o tick só vier muito depois do fim', () => {
    const s = useExecStore.getState();
    s.setPreset(30);
    s.startTimer();
    vi.setSystemTime(Date.now() + 5 * 60_000);
    const r = useExecStore.getState().tick();
    expect(r.justFinished).toBe(true);
    const st = useExecStore.getState();
    expect(st.remaining).toBe(0);
    expect(st.running).toBe(false);
    expect(st.alarming).toBe(true);
    expect(st.endAt).toBeNull();
    expect(useExecStore.getState().tick().justFinished).toBe(false); // não repete
  });

  it('pausar congela o valor real e retomar continua dele', () => {
    const s = useExecStore.getState();
    s.setPreset(60);
    s.startTimer();
    vi.setSystemTime(Date.now() + 20_000);
    useExecStore.getState().pauseTimer();
    expect(useExecStore.getState().remaining).toBe(40);
    vi.setSystemTime(Date.now() + 10_000); // pausado: não conta
    useExecStore.getState().startTimer();
    vi.setSystemTime(Date.now() + 10_000);
    useExecStore.getState().tick();
    expect(useExecStore.getState().remaining).toBe(30);
  });

  it('±30s com o timer rodando desloca o fim sem perder o tempo decorrido', () => {
    const s = useExecStore.getState();
    s.setPreset(60);
    s.startTimer();
    vi.setSystemTime(Date.now() + 10_000);
    useExecStore.getState().adjustRest(30);
    expect(useExecStore.getState().restDuration).toBe(90);
    expect(useExecStore.getState().remaining).toBe(80);
  });

  it('recomeçar durante o alarme silencia o alarme e reinicia o descanso', () => {
    const s = useExecStore.getState();
    s.setPreset(30);
    s.startTimer();
    vi.setSystemTime(Date.now() + 31_000);
    useExecStore.getState().tick();
    expect(useExecStore.getState().alarming).toBe(true);
    useExecStore.getState().startTimer();
    const st = useExecStore.getState();
    expect(st.alarming).toBe(false);
    expect(st.running).toBe(true);
    expect(st.remaining).toBe(30);
  });

  it('resetar e fechar limpam endAt', () => {
    const s = useExecStore.getState();
    s.startTimer();
    useExecStore.getState().resetTimer();
    expect(useExecStore.getState().endAt).toBeNull();
    useExecStore.getState().startTimer();
    useExecStore.getState().close();
    expect(useExecStore.getState().endAt).toBeNull();
  });
});
