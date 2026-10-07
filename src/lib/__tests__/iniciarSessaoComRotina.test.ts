import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
import { iniciarSessaoComRotina } from '../iniciarSessaoComRotina';
import { useSessionStore, MAX_SESSOES } from '../../store/useSessionStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { criarRotinaVazia } from '../../types/aluno';

function rotinaComSupino() {
  const r = criarRotinaVazia();
  r[0] = { tipo: 'Peito', exercicios: [{ nome: 'Supino Reto', series: 3, reps: '10', carga: 40 }] };
  return r;
}

describe('iniciarSessaoComRotina', () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: [], activeSessionId: null, ownSnapshot: null });
    useWorkoutStore.setState({ weekLog: {}, weekPSE: {}, exDone: {} });
  });

  it('abre a sessão focada e carrega a semana', () => {
    const r = iniciarSessaoComRotina('a1', 'Ana Silva', rotinaComSupino());
    expect(r.ok).toBe(true);
    const st = useSessionStore.getState();
    expect(st.sessions).toHaveLength(1);
    expect(st.activeSessionId).toBe(st.sessions[0].id);
    expect(useWorkoutStore.getState().weekLog[0]).toHaveLength(1);
  });

  it('reaproveita a sessão existente do aluno', () => {
    iniciarSessaoComRotina('a1', 'Ana', rotinaComSupino());
    iniciarSessaoComRotina('a1', 'Ana', rotinaComSupino());
    expect(useSessionStore.getState().sessions).toHaveLength(1);
  });

  it('falha no limite de sessões sem alterar o treino atual', () => {
    for (let i = 0; i < MAX_SESSOES; i++) useSessionStore.getState().abrirNovaSessao(`x${i}`, `X${i}`);
    useWorkoutStore.setState({ weekLog: {} });
    const r = iniciarSessaoComRotina('novo', 'Novo', rotinaComSupino());
    expect(r).toEqual({ ok: false, motivo: 'limite' });
    expect(useWorkoutStore.getState().weekLog[0]).toBeUndefined();
  });
});
