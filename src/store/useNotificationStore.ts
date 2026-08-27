import { create } from 'zustand';
import type { TreinoNotificacao } from '../types/notification';
import { dispensarNotificacao, fetchTreinoNotificacoes, marcarNotificacaoLida } from '../lib/notificacaoRepository';

interface NotificationState {
  items: TreinoNotificacao[];
  loading: boolean;
  loaded: boolean;

  fetchAll: () => Promise<void>;
  /** Marca todas como lidas — chamada ao abrir a aba Notificações, equivale a ntf_onViewOpen(). */
  markAllRead: () => Promise<void>;
  /** Remove a notificação da lista — equivale a ntf_dismissTreino(). */
  dismiss: (id: string) => Promise<void>;
}

/**
 * Estado das notificações "Treino concluído" — sucessor de `ntf_treinos`
 * em memória (index.html ~10406). Só o Personal chama fetchAll()
 * (disparado uma vez ao conceder acesso PT, ver useAuthStore.init()) —
 * badge da nav e a NotificationsView leem daqui.
 */
export const useNotificationStore = create<NotificationState>()((set, get) => ({
  items: [],
  loading: false,
  loaded: false,

  fetchAll: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const items = await fetchTreinoNotificacoes();
      set({ items, loaded: true });
    } catch (e) {
      console.error('useNotificationStore: falha ao carregar notificações', e);
    } finally {
      set({ loading: false });
    }
  },

  markAllRead: async () => {
    const unread = get().items.filter((n) => !n.lida);
    if (!unread.length) return;
    // Otimista — o badge já zera sem esperar o Firestore.
    set({ items: get().items.map((n) => ({ ...n, lida: true })) });
    try {
      await Promise.all(unread.map((n) => marcarNotificacaoLida(n.id)));
    } catch (e) {
      console.error('useNotificationStore: falha ao marcar todas como lidas', e);
    }
  },

  dismiss: async (id) => {
    const before = get().items;
    set({ items: before.filter((n) => n.id !== id) });
    try {
      await dispensarNotificacao(id);
    } catch (e) {
      console.error('useNotificationStore: falha ao dispensar notificação', e);
      set({ items: before });
    }
  },
}));

/** Equivale a ntf_countNaoLidas() (só a parte de "treino concluído" — ver types/notification.ts). */
export function selectUnreadCount(state: NotificationState): number {
  return state.items.filter((n) => !n.lida).length;
}
