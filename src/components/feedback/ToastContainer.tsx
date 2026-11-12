import { useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import type { Toast, ToastType } from '../../store/useUIStore';
import './ToastContainer.css';

const TOAST_ICON: Record<ToastType, string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '⛔',
};

/** Tempo na tela por tipo: avisos e erros precisam de mais tempo de leitura que uma confirmação. */
const TOAST_DURATION_MS: Record<ToastType, number> = {
  info: 2700,
  success: 2700,
  warning: 4500,
  error: 6000,
};

/** Sozinho, faz o auto-dismiss de um toast — sucessor do setTimeout(2700ms) de toast() (index.html ~7222). */
function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    const id = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS[toast.type]);
    return () => clearTimeout(id);
  }, [toast.id, toast.type, dismissToast]);

  return (
    <div className={`toast toast-${toast.type}`} onClick={() => dismissToast(toast.id)}>
      <span className="toast-icon" aria-hidden="true">
        {TOAST_ICON[toast.type]}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

/** Sucessor de `#toast` (index.html ~3527, CSS ~385) — várias mensagens empilham em vez de substituir uma única. */
export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  // O container fica sempre montado: leitores de tela só anunciam mudanças em uma
  // região live que já existia antes do conteúdo aparecer. Erros usam role="alert".
  const hasError = toasts.some((t) => t.type === 'error');

  return (
    <div className="toast-stack" role={hasError ? 'alert' : 'status'} aria-live={hasError ? 'assertive' : 'polite'}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
