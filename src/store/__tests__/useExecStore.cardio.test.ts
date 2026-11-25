import { afterEach, describe, expect, it } from 'vitest';
import { useExecStore } from '../useExecStore';

afterEach(() => useExecStore.getState().close());

describe('useExecStore — cardio', () => {
  it('cronômetro = tempo prescrito inteiro; uma única "série" de conclusão', () => {
    useExecStore.getState().open(1, 2, { isCardio: true, totalSets: 1, durationSec: 30 * 60 });
    const s = useExecStore.getState();
    expect(s.totalSets).toBe(1);
    expect(s.restDuration).toBe(1800);
    expect(s.remaining).toBe(1800);
    expect(s.done).toEqual([false]);
  });
  it('toggleSet(0) conclui e desfaz; ajustes de descanso são ignorados no cardio', () => {
    useExecStore.getState().open(0, 0, { isCardio: true, totalSets: 1, durationSec: 600 });
    expect(useExecStore.getState().toggleSet(0)).toEqual({ justCompleted: true, allDone: true });
    expect(useExecStore.getState().toggleSet(0).justCompleted).toBe(false);
    useExecStore.getState().adjustRest(30);
    useExecStore.getState().setPreset(30);
    expect(useExecStore.getState().restDuration).toBe(600);
  });
  it('alreadyDone abre com o check marcado', () => {
    useExecStore.getState().open(0, 0, { isCardio: true, totalSets: 1, durationSec: 600, alreadyDone: true });
    expect(useExecStore.getState().done).toEqual([true]);
    expect(useExecStore.getState().current).toBe(1);
  });
});
