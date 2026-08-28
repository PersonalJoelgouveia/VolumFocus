import { create } from 'zustand';

interface ConfirmOptions {
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: ((value: boolean) => void) | null;

  /** Sucessor de vfConfirm(message, opts) — Promise que resolve `true`
   *  (confirmou) ou `false` (cancelou/fechou). Substitui window.confirm()
   *  nativo por um modal no padrão visual do app. */
  ask: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  isOpen: false,
  message: '',
  confirmLabel: 'Confirmar',
  danger: false,
  resolve: null,

  ask: (message, opts = {}) =>
    new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        message,
        confirmLabel: opts.confirmLabel ?? 'Confirmar',
        danger: opts.danger ?? false,
        resolve,
      });
    }),

  handleConfirm: () => {
    get().resolve?.(true);
    set({ isOpen: false, resolve: null });
  },

  handleCancel: () => {
    get().resolve?.(false);
    set({ isOpen: false, resolve: null });
  },
}));
