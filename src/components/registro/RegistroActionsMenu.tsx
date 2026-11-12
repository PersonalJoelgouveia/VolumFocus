import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownUp, Check, ClipboardCopy, Download, Link2, Timer, X } from 'lucide-react';
import type { ListMode } from './ExerciseListItem';
import './RegistroActionsMenu.css';

interface RegistroActionsMenuProps {
  mode: ListMode;
  dayLogLength: number;
  freeCount: number;
  isTimerActive: boolean;
  onIniciarTreino: () => void;
  onImportar: () => void;
  onClonarDia: () => void;
  onToggleConjugar: () => void;
  onToggleReorder: () => void;
}

/**
 * Menu "Ações do Treino" — sucessor dos 5 botões individuais (Conjugar,
 * Reordenar, Clonar Dia, Importar Treino, Iniciar Treino) que antes
 * ficavam soltos no cabeçalho de Treinos > Semana Atual. Agrupados atrás
 * de um único botão hambúrguer para reduzir ruído visual no mobile —
 * mesmas condições de visibilidade/rótulo de antes, só reorganizadas.
 */
export function RegistroActionsMenu({
  mode,
  dayLogLength,
  freeCount,
  isTimerActive,
  onIniciarTreino,
  onImportar,
  onClonarDia,
  onToggleConjugar,
  onToggleReorder,
}: RegistroActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const ic = (I: typeof Link2) => <I size={16} aria-hidden="true" />;
  const items: { key: string; icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }[] = [];

  if (mode !== 'reorder' && freeCount >= 2) {
    items.push({
      key: 'conjugar',
      icon: mode === 'conjugar' ? ic(X) : ic(Link2),
      label: mode === 'conjugar' ? 'Cancelar Conjugar' : 'Conjugar',
      onClick: onToggleConjugar,
    });
  }
  if (mode !== 'conjugar' && dayLogLength > 1) {
    items.push({
      key: 'reordenar',
      icon: mode === 'reorder' ? ic(Check) : ic(ArrowDownUp),
      label: mode === 'reorder' ? 'Concluir Reordenação' : 'Reordenar',
      onClick: onToggleReorder,
    });
  }
  if (mode === 'normal') {
    items.push({ key: 'clonar', icon: ic(ClipboardCopy), label: 'Clonar Dia', onClick: onClonarDia, disabled: dayLogLength === 0 });
    items.push({ key: 'importar', icon: ic(Download), label: 'Importar Treino', onClick: onImportar });
    if (!isTimerActive) {
      items.push({ key: 'iniciar-treino', icon: ic(Timer), label: 'Iniciar Treino', onClick: onIniciarTreino });
    }
  }

  if (items.length === 0) return null;

  function handleSelect(fn: () => void) {
    fn();
    setOpen(false);
  }

  return (
    <div className="ram-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ram-toggle"
        aria-label="Ações do treino"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ram-bar" />
        <span className="ram-bar" />
        <span className="ram-bar" />
        <span className="ram-bar" />
        <span className="ram-bar" />
      </button>

      {open && (
        <div className="ram-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="ram-item"
              disabled={item.disabled}
              onClick={() => handleSelect(item.onClick)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
