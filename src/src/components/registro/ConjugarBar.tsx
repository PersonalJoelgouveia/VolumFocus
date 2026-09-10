import { GROUP_LABELS } from '../../types/workout';
import type { GroupType } from '../../types/workout';

interface ConjugarBarProps {
  count: number;
  groupType: GroupType;
  onChangeType: (type: GroupType) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Sucessor da barra flutuante de ações do modo Conjugar (index.html ~9481-9520, cjToggle/cjSelect). */
export function ConjugarBar({ count, groupType, onChangeType, onConfirm, onCancel }: ConjugarBarProps) {
  const visible = count > 0;

  return (
    <div className={`cj-bar${visible ? ' cj-bar-show' : ''}`}>
      <span className="cj-bar-count">{count} selecionado{count === 1 ? '' : 's'}</span>
      <select value={groupType} onChange={(e) => onChangeType(e.target.value as GroupType)}>
        {(Object.entries(GROUP_LABELS) as [GroupType, string][]).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>
        ×
      </button>
      <button className="cj-bar-confirm" disabled={count < 2} onClick={onConfirm}>
        Conjugar
      </button>
    </div>
  );
}
