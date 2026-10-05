import { create } from 'zustand';
import { auth } from '../lib/firebase';
import { listarRotinasAluno } from '../lib/alunoRotinasRepository';
import { ordenarRotinasAluno } from '../utils/ordenarRotinasAluno';
import type { AlunoRotinaSalva } from '../types/aluno';
import { useAuthStore } from './useAuthStore';

/**
 * Leitura das rotinas do PRÓPRIO aluno autenticado: `alunos/{email}/rotinas`.
 *
 * IDENTIDADE — nada aqui aceita e-mail/id vindo da UI. A coleção lida é sempre a do
 * e-mail de `auth.currentUser` (Firebase Auth), e só quando:
 *   - o e-mail está verificado pelo Google;
 *   - o papel do app é 'aluno' (useAuthStore: não é PT e o doc `alunos/{email}` existe);
 *   - o e-mail do papel coincide com o do Firebase Auth.
 * Qualquer falha → nenhuma leitura, status 'nao-autorizado'. As Firestore Rules
 * (`ehDono(email)`) são a barreira real; esta checagem evita nem tentar.
 *
 * Leitura ÚNICA (getDocs), sem listener — igual ao restante do app para este dado.
 * Memória apenas (sem persist): nada de rotina do aluno fica no localStorage.
 *
 * Os arrays são calculados UMA vez ao carregar e guardados no estado, então os
 * seletores devolvem sempre a mesma referência (evita loop de render, React #185).
 */

export type StatusMinhasRotinas = 'idle' | 'carregando' | 'pronto' | 'erro' | 'nao-autorizado';

const VAZIO: readonly AlunoRotinaSalva[] = Object.freeze([]);

/** E-mail do aluno autenticado, ou `null` se não houver identidade de aluno válida. */
export function resolverEmailDoAlunoAutenticado(): string | null {
  const fb = auth.currentUser;
  const email = fb?.email?.trim().toLowerCase();
  if (!fb || !email || fb.emailVerified !== true) return null;
  const { role, user } = useAuthStore.getState();
  if (role !== 'aluno' || user?.email.trim().toLowerCase() !== email) return null;
  return email;
}

interface MinhasRotinasState {
  status: StatusMinhasRotinas;
  /** E-mail dono dos dados em memória (para descartar se a conta mudar). */
  donoEmail: string | null;
  /** Todas as rotinas salvas (mais recentemente criada primeiro). */
  rotinas: readonly AlunoRotinaSalva[];
  /** Rotina com `ativa === true`, ou `null`. */
  ativa: AlunoRotinaSalva | null;
  /** Ativa primeiro, depois `atualizadaEm` mais recente. */
  ordenadas: readonly AlunoRotinaSalva[];
  erro: string | null;

  /** Recarrega do Firestore. Não recebe e-mail: a identidade vem do Firebase Auth. */
  carregar: () => Promise<void>;
  limpar: () => void;
}

const ESTADO_INICIAL = {
  status: 'idle' as StatusMinhasRotinas,
  donoEmail: null,
  rotinas: VAZIO,
  ativa: null,
  ordenadas: VAZIO,
  erro: null,
};

let tokenCarga = 0;

export const useMinhasRotinasStore = create<MinhasRotinasState>()((set) => ({
  ...ESTADO_INICIAL,

  carregar: async () => {
    const token = ++tokenCarga;
    const email = resolverEmailDoAlunoAutenticado();
    if (!email) {
      set({ ...ESTADO_INICIAL, status: 'nao-autorizado', erro: 'Faça login como aluno para ver suas rotinas.' });
      return;
    }
    set((s) => ({
      // Outra conta nos dados em memória? Não reaproveita nada dela.
      ...(s.donoEmail === email ? { status: 'carregando' as const } : { ...ESTADO_INICIAL, status: 'carregando' as const }),
      donoEmail: email,
      erro: null,
    }));
    try {
      const rotinas = await listarRotinasAluno(email);
      // Chamada mais nova em andamento, ou a conta mudou durante a leitura: descarta.
      if (token !== tokenCarga || resolverEmailDoAlunoAutenticado() !== email) return;
      set({
        status: 'pronto',
        donoEmail: email,
        rotinas,
        ativa: rotinas.find((r) => r.ativa) ?? null,
        ordenadas: ordenarRotinasAluno(rotinas),
        erro: null,
      });
    } catch (e) {
      if (token !== tokenCarga) return;
      console.error('useMinhasRotinasStore: falha ao carregar rotinas', e);
      set({ status: 'erro', erro: 'Não foi possível carregar suas rotinas. Tente novamente.' });
    }
  },

  limpar: () => {
    tokenCarga++;
    set({ ...ESTADO_INICIAL });
  },
}));

/** Seletores (leituras diretas do estado — referências estáveis). */
export const selectTodasRotinas = (s: MinhasRotinasState): readonly AlunoRotinaSalva[] => s.rotinas;
export const selectRotinaAtiva = (s: MinhasRotinasState): AlunoRotinaSalva | null => s.ativa;
export const selectRotinasOrdenadas = (s: MinhasRotinasState): readonly AlunoRotinaSalva[] => s.ordenadas;
export const selectStatusMinhasRotinas = (s: MinhasRotinasState): StatusMinhasRotinas => s.status;

// Logout/troca de conta: nenhuma rotina de um aluno sobrevive na memória para o próximo.
useAuthStore.subscribe((state, prev) => {
  if (state.user?.email !== prev.user?.email || state.role !== prev.role) {
    useMinhasRotinasStore.getState().limpar();
  }
});
