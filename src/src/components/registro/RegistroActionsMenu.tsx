import { useEffect, useRef, useState } from 'react';
import type { ListMode } from './ExerciseListItem';
import './RegistroActionsMenu.css';

interface RegistroActionsMenuProps {
  mode: ListMode;
  dayLogLength: number;
  freeCount: number;
  isTimerActive: boolean;
  onCronometrar: () => void;
  onImportar: () => void;
  onClonarDia: () => void;
  onToggleConjugar: () => void;
  onToggleReorder: () => void;
}

/**
 * Menu "Ações do Treino" — sucessor dos 5 botões individuais (Conjugar,
 * Reordenar, Clonar Dia, Importar Treino, Cronometrar Treino) que antes
 * ficavam soltos no cabeçalho de Treinos > Semana Atual. Agrupados atrás
 * de um único botão hambúrguer para reduzir ruído visual no mobile —
 * mesmas condições de visibilidade/rótulo de antes, só reorganizadas.
 */
export function RegistroActionsMenu({
  mode,
  dayLogLength,
  freeCount,
  isTimerActive,
  onCronometrar,
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

  const items: { key: string; label: string; onClick: () => void; disabled?: boolean }[] = [];

  if (mode !== 'reorder' && freeCount >= 2) {
    items.push({
      key: 'conjugar',
      label: mode === 'conjugar' ? '× Cancelar Conjugar' : '🔗 Conjugar',
      onClick: onToggleConjugar,
    });
  }
  if (mode !== 'conjugar' && dayLogLength > 1) {
    items.push({
      key: 'reordenar',
      label: mode === 'reorder' ? '✓ Concluir Reordenação' : '↕️ Reordenar',
      onClick: onToggleReorder,
    });
  }
  if (mode === 'normal') {
    items.push({ key: 'clonar', label: '📋 Clonar Dia', onClick: onClonarDia, disabled: dayLogLength === 0 });
    items.push({ key: 'importar', label: '📥 Importar Treino', onClick: onImportar });
    if (!isTimerActive) {
      items.push({ key: 'cronometrar', label: '⏱️ Cronometrar Treino', onClick: onCronometrar });
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
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
