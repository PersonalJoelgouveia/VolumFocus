import { create } from 'zustand';
import type { ViewId } from '../types/view';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/**
 * Estado de UI centralizado: navegação entre views (substitui switchView() +
 * manipulação direta de classList do monolito), modais, popover "Mais" da
 * bottom-nav (bnToggleMore/bnCloseMore) e toasts.
 */
interface UIState {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;

  /** Equivale a `isPersonalMode` do monolito — controla visibilidade das views `pt-only`. */
  isPersonalMode: boolean;
  setPersonalMode: (isPersonal: boolean) => void;

  /** Reverso de isPersonalMode — true quando o usuário logado é um aluno
   *  cadastrado (não-PT). Controla a visibilidade das views `alunoOnly`. */
  isAlunoMode: boolean;
  setAlunoMode: (isAluno: boolean) => void;

  openModalId: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;

  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;

  /** Popover "Mais" da bottom-nav mobile (bnToggleMore/bnCloseMore). */
  isMoreMenuOpen: boolean;
  toggleMoreMenu: () => void;
  closeMoreMenu: () => void;

  toasts: Toast[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activeView: 'registro',
  setActiveView: (view) => set({ activeView: view, isMoreMenuOpen: false }),

  isPersonalMode: false,
  setPersonalMode: (isPersonal) => set({ isPersonalMode: isPersonal }),

  isAlunoMode: false,
  setAlunoMode: (isAluno) => set({ isAlunoMode: isAluno }),

  openModalId: null,
  openModal: (id) => set({ openModalId: id }),
  closeModal: () => set({ openModalId: null }),

  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  isMoreMenuOpen: false,
  toggleMoreMenu: () => set((state) => ({ isMoreMenuOpen: !state.isMoreMenuOpen })),
  closeMoreMenu: () => set({ isMoreMenuOpen: false }),

  toasts: [],
  showToast: (message, type = 'info') =>
    set((state) => ({ toasts: [...state.toasts, { id: Date.now() + Math.random(), message, type }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
