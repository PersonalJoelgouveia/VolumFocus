import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));

import { aplicarTreinoHoje, exerciciosNoDia, exerciciosNoDiaDaSessao, iniciarSessaoComTreino } from '../aplicarTreinoNoDia';
import { useSessionStore, MAX_SESSOES } from '../../store/useSessionStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { getTodayDayIndex } from '../../utils/dayIndex';
import type { AlunoRotinaDia } from '../../types/aluno';

const treinoA: AlunoRotinaDia = { tipo: 'Peito', exercicios: [{ nome: 'Supino Reto', series: 3, reps: '10', carga: 40 }, { nome: 'Crucifixo', series: 3, reps: '12', carga: 14 }] };
const hoje = getTodayDayIndex();

describe('treino no dia de hoje', () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: [], activeSessionId: null, ownSnapshot: null });
    useWorkoutStore.setState({ weekLog: {}, weekPSE: {}, exDone: {} });
  });

  it('aluno: coloca só o dia de hoje, preservando os outros dias e limpando concluídos de hoje', () => {
    const outro = (hoje + 1) % 7;
    useWorkoutStore.setState({
      weekLog: { [outro]: [{ exId: 'x', sets: 1, reps: 1, load: 1, serieLoads: [1], serieReps: [1] }] },
      weekPSE: { [hoje]: 7, [outro]: 6 },
      exDone: { [`${hoje}:0`]: true, [`${outro}:0`]: true } as never,
    });
    expect(exerciciosNoDia(hoje)).toBe(0);
    aplicarTreinoHoje(treinoA);
    const s = useWorkoutStore.getState();
    expect(s.weekLog[hoje]).toHaveLength(2);
    expect(s.weekLog[outro]).toHaveLength(1);
    expect(s.weekPSE[hoje]).toBeUndefined();
    expect(s.weekPSE[outro]).toBe(6);
    expect(s.exDone[`${hoje}:0`]).toBeUndefined();
    expect(s.exDone[`${outro}:0`]).toBe(true);
    expect(s.selectedDay).toBe(hoje);
    expect(exerciciosNoDia(hoje)).toBe(2);
  });

  it('personal: abre a sessão do aluno com o treino em hoje; sobreposição é detectável antes', () => {
    expect(exerciciosNoDiaDaSessao('a1', hoje)).toBe(0);
    const r = iniciarSessaoComTreino('a1', 'Ana', treinoA);
    expect(r.ok).toBe(true);
    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(exerciciosNoDiaDaSessao('a1', hoje)).toBe(2); // sessão em foco
    useSessionStore.getState().alternarSessao(null);
    expect(exerciciosNoDiaDaSessao('a1', hoje)).toBe(2); // sessão em segundo plano
    expect(exerciciosNoDia(hoje)).toBe(0); // "Meu Treino" do Personal intacto
  });

  it('personal: limite de sessões não altera o treino atual', () => {
    for (let i = 0; i < MAX_SESSOES; i++) useSessionStore.getState().abrirNovaSessao(`x${i}`, `X${i}`);
    useSessionStore.getState().alternarSessao(null);
    expect(iniciarSessaoComTreino('novo', 'Novo', treinoA)).toEqual({ ok: false, motivo: 'limite' });
    expect(exerciciosNoDia(hoje)).toBe(0);
  });
});
