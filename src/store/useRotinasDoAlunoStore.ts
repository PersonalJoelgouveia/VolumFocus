import { create } from 'zustand';
import { listarRotinasAluno } from '../lib/alunoRotinasRepository';
import { ordenarRotinasAluno } from '../utils/ordenarRotinasAluno';
import type { AlunoRotinaSalva } from '../types/aluno';
import { useAuthStore } from './useAuthStore';

/**
 * Lado do PERSONAL: leitura das rotinas de um aluno (`alunos/{email}/rotinas`) — a mesma
 * fonte de verdade que o aluno lê (useMinhasRotinasStore), só que por e-mail, porque o
 * Personal acompanha vários alunos. Só funciona com papel 'personal' (as Rules também exigem).
 *
 * Leitura única + refresh explícito (o app não usa listeners para esse dado): quem grava
 * uma rotina (Salvar Atual / Salvar & Publicar) chama `carregar(email)` em seguida, e o mini
 * perfil também carrega ao abrir — sem recarregar a página. Só memória (sem persist).
 * Entradas por e-mail com referências estáveis (evita loop de render, React #185).
 */

export type StatusRotinasAluno = 'idle' | 'carregando' | 'pronto' | 'erro' | 'nao-autorizado';

export interface RotinasDoAluno {
  status: StatusRotinasAluno;
  /** Ativa primeiro, depois `atualizadaEm` mais recente. */
  ordenadas: readonly AlunoRotinaSalva[];
  ativa: AlunoRotinaSalva | null;
  erro: string | null;
}

export const ROTINAS_ALUNO_VAZIO: RotinasDoAluno = Object.freeze({
  status: 'idle',
  ordenadas: Object.freeze([]) as readonly AlunoRotinaSalva[],
  ativa: null,
  erro: null,
});

interface State {
  porEmail: Record<string, RotinasDoAluno>;
  carregar: (studentEmail: string) => Promise<void>;
  limpar: () => void;
}

const emAndamento = new Map<string, Promise<void>>();
const tokens = new Map<string, number>();

export const useRotinasDoAlunoStore = create<State>()((set) => ({
  porEmail: {},

  carregar: (studentEmail) => {
    const email = studentEmail.trim().toLowerCase();
    if (!email.includes('@')) return Promise.resolve();
    const atual = emAndamento.get(email);
    if (atual) return atual;
    const promessa = (async () => {
      const token = (tokens.get(email) ?? 0) + 1;
      tokens.set(email, token);
      const setEntrada = (e: Partial<RotinasDoAluno>) =>
        set((s) => ({ porEmail: { ...s.porEmail, [email]: { ...(s.porEmail[email] ?? ROTINAS_ALUNO_VAZIO), ...e } } }));

      if (useAuthStore.getState().role !== 'personal') {
        setEntrada({ status: 'nao-autorizado', erro: 'Apenas o Personal vê as rotinas dos alunos.' });
        return;
      }
      setEntrada({ status: 'carregando', erro: null });
      try {
        const ordenadas = ordenarRotinasAluno(await listarRotinasAluno(email));
        if (tokens.get(email) !== token) return; // limpar() durante a leitura
        setEntrada({ status: 'pronto', ordenadas, ativa: ordenadas[0]?.ativa ? ordenadas[0] : null, erro: null });
      } catch (e) {
        if (tokens.get(email) !== token) return;
        console.error('useRotinasDoAlunoStore: falha ao carregar rotinas do aluno', e);
        setEntrada({ status: 'erro', erro: 'Não foi possível carregar as rotinas do aluno. Tente novamente.' });
      }
    })();
    emAndamento.set(email, promessa);
    void promessa.finally(() => {
      if (emAndamento.get(email) === promessa) emAndamento.delete(email);
    });
    return promessa;
  },

  limpar: () => {
    tokens.forEach((v, k) => tokens.set(k, v + 1));
    emAndamento.clear();
    set({ porEmail: {} });
  },
}));

/** Seletor por e-mail (referência estável: a entrada só muda quando os dados mudam). */
export const selectRotinasDoAluno =
  (email: string) =>
  (s: State): RotinasDoAluno =>
    s.porEmail[email.trim().toLowerCase()] ?? ROTINAS_ALUNO_VAZIO;

// Logout/troca de conta: nenhum cache de alunos de um Personal sobrevive na memória.
useAuthStore.subscribe((state, prev) => {
  if (state.user?.email !== prev.user?.email || state.role !== prev.role) {
    useRotinasDoAlunoStore.getState().limpar();
  }
});
