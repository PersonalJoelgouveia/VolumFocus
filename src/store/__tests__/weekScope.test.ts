import { beforeEach, describe, expect, it } from 'vitest';
import { useRetroWeeksStore } from '../useRetroWeeksStore';
import { useWorkoutStore } from '../useWorkoutStore';
import { useUIStore } from '../useUIStore';
import { getWeekApi, retroAtivo } from '../weekScope';

const forca = { exId: 'e1', sets: 3, reps: 10, load: 50 } as never;

beforeEach(() => {
  useRetroWeeksStore.setState({ weeks: {}, activeKey: null, selectedDay: 0 });
  useWorkoutStore.setState({ weekLog: {}, exDone: {}, weekPSE: {}, selectedDay: 0 });
  useUIStore.setState({ activeView: 'registro' });
});

describe('weekScope — semana em edição', () => {
  it('sem semana retroativa aberta, a fachada é o store da semana atual', () => {
    expect(retroAtivo()).toBe(false);
    getWeekApi().addLogEntry(1, forca);
    expect(useWorkoutStore.getState().weekLog[1]).toHaveLength(1);
    expect(useRetroWeeksStore.getState().weeks).toEqual({});
  });

  it('com a tela retroativa aberta, grava SÓ na semana retroativa (a atual fica intacta)', () => {
    useRetroWeeksStore.getState().open('2026-11-16', 2);
    useUIStore.setState({ activeView: 'retro' });
    expect(retroAtivo()).toBe(true);
    const api = getWeekApi();
    expect(api.selectedDay).toBe(2);
    api.addLogEntry(2, forca);
    api.markExerciseDone(2, 0);
    api.setDayPSE(2, 7);
    api.updateLogEntry(2, 0, { load: 60 } as never);
    const w = useRetroWeeksStore.getState().weeks['2026-11-16'];
    expect(w.weekLog[2]).toHaveLength(1);
    expect((w.weekLog[2][0] as { load: number }).load).toBe(60);
    expect(w.exDone['2:0']).toBe(true);
    expect(w.weekPSE[2]).toBe(7);
    expect(useWorkoutStore.getState().weekLog).toEqual({});
    expect(useWorkoutStore.getState().exDone).toEqual({});
    expect(getWeekApi().isExerciseDone(2, 0)).toBe(true);
    expect(getWeekApi().getDayLog(2)).toHaveLength(1);
  });

  it('semana aberta mas fora da tela retroativa: volta a valer a semana atual', () => {
    useRetroWeeksStore.getState().open('2026-11-16', 2);
    useUIStore.setState({ activeView: 'performance' });
    expect(retroAtivo()).toBe(false);
    getWeekApi().addLogEntry(0, forca);
    expect(useWorkoutStore.getState().weekLog[0]).toHaveLength(1);
    expect(useRetroWeeksStore.getState().weeks['2026-11-16']).toBeUndefined();
  });

  it('remover, desmarcar e limpar o dia na semana retroativa', () => {
    useRetroWeeksStore.getState().open('2026-11-16', 0);
    useUIStore.setState({ activeView: 'retro' });
    const api = getWeekApi();
    api.addLogEntry(0, forca);
    api.addLogEntry(0, forca);
    api.markExerciseDone(0, 0);
    api.markExerciseDone(0, 1);
    api.unmarkExerciseDone(0, 0);
    expect(getWeekApi().isExerciseDone(0, 0)).toBe(false);
    api.clearDayDone(0);
    expect(useRetroWeeksStore.getState().weeks['2026-11-16'].exDone).toEqual({});
    api.removeLogEntry(0, 0);
    expect(getWeekApi().getDayLog(0)).toHaveLength(1);
  });
});
