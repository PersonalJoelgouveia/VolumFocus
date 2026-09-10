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

/** Sozinho, faz o auto-dismiss de um toast — sucessor do setTimeout(2700ms) de toast() (index.html ~7222). */
function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    const id = setTimeout(() => dismissToast(toast.id), 2700);
    return () => clearTimeout(id);
  }, [toast.id, dismissToast]);

  return (
    <div className={`toast toast-${toast.type}`} onClick={() => dismissToast(toast.id)}>
      <span className="toast-icon">{TOAST_ICON[toast.type]}</span>
      <span>{toast.message}</span>
    </div>
  );
}

/** Sucessor de `#toast` (index.html ~3527, CSS ~385) — várias mensagens empilham em vez de substituir uma única. */
export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
