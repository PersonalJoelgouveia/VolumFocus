import { create } from 'zustand';
import { createTeste, deleteTeste, listTestes } from '../lib/testesDesempenhoRepository';
import type { TesteCardioDoc, TesteDesempenhoDoc, TesteForcaDoc } from '../utils/testesDesempenho';

/**
 * Testes de Força/Cardio guardados na nuvem, por e-mail de aluno. SÓ EM MEMÓRIA (sem `persist`):
 * é dado de saúde de terceiros — nada vai a localStorage (política do Mini 7). Recarrega a cada sessão.
 */
export type TestesStatus = 'idle' | 'loading' | 'ready' | 'error';

interface Entrada {
  status: TestesStatus;
  docs: TesteDesempenhoDoc[];
}

interface State {
  byEmail: Record<string, Entrada>;
  carregar: (email: string, forcar?: boolean) => Promise<void>;
  /** Otimista: adiciona local, grava na nuvem, desfaz se falhar. Retorna se gravou. */
  adicionar: (email: string, doc: TesteForcaDoc | TesteCardioDoc) => Promise<boolean>;
  remover: (email: string, id: string) => Promise<boolean>;
  limpar: () => void;
}

const key = (e: string) => e.toLowerCase();
const emVoo = new Map<string, Promise<void>>();

export const useTestesRemotosStore = create<State>()((set, get) => ({
  byEmail: {},

  carregar: (email, forcar = false) => {
    const k = key(email);
    const atual = get().byEmail[k];
    if (!forcar && atual && (atual.status === 'ready' || atual.status === 'loading')) return emVoo.get(k) ?? Promise.resolve();
    set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: 'loading', docs: s.byEmail[k]?.docs ?? [] } } }));
    const p = listTestes(k)
      .then((docs) => set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: 'ready', docs } } })))
      .catch((e) => {
        console.error('useTestesRemotosStore: falha ao carregar testes', e);
        set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: 'error', docs: s.byEmail[k]?.docs ?? [] } } }));
      })
      .finally(() => emVoo.delete(k));
    emVoo.set(k, p);
    return p;
  },

  adicionar: async (email, doc) => {
    const k = key(email);
    const antes = get().byEmail[k]?.docs ?? [];
    set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: s.byEmail[k]?.status ?? 'ready', docs: [doc, ...antes] } } }));
    try {
      await createTeste(k, doc);
      return true;
    } catch (e) {
      console.error('useTestesRemotosStore: falha ao salvar teste', e);
      set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: s.byEmail[k]?.status ?? 'ready', docs: (s.byEmail[k]?.docs ?? []).filter((d) => d.id !== doc.id) } } }));
      return false;
    }
  },

  remover: async (email, id) => {
    const k = key(email);
    const antes = get().byEmail[k]?.docs ?? [];
    const alvo = antes.find((d) => d.id === id);
    if (!alvo) return false;
    set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: s.byEmail[k]?.status ?? 'ready', docs: antes.filter((d) => d.id !== id) } } }));
    try {
      await deleteTeste(k, id);
      return true;
    } catch (e) {
      console.error('useTestesRemotosStore: falha ao remover teste', e);
      set((s) => ({ byEmail: { ...s.byEmail, [k]: { status: s.byEmail[k]?.status ?? 'ready', docs: [alvo, ...(s.byEmail[k]?.docs ?? [])] } } }));
      return false;
    }
  },

  limpar: () => {
    emVoo.clear();
    set({ byEmail: {} });
  },
}));
