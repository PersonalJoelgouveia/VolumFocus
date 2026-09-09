import { useRef, useState } from 'react';
import { NavTooltip } from './NavTooltip';

const LONG_PRESS_MS = 450;

interface NavItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  /** true = drawer aberto (ícone + rótulo lado a lado); false = rail icon-only. */
  expanded?: boolean;
  badgeCount?: number;
  onSelect: () => void;
}

/**
 * Ícone de navegação da MobileSidebar. Em modo icon-only (`expanded=false`,
 * padrão) um toque rápido navega direto; toque-e-retenção (long-press)
 * revela o Tooltip com o rótulo completo sem navegar, com haptic feedback
 * (Vibration API, best-effort — silenciosamente ignorado onde não suportado).
 * Em modo expandido o rótulo já fica visível inline, então o tooltip nunca é
 * necessário. Substitui os títulos cortados da antiga bottom-nav.
 */
export function NavItem({ icon, label, isActive, expanded = false, badgeCount = 0, onSelect }: NavItemProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (expanded) return;
    longPressFired.current = false;
    clearPressTimer();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setTooltipVisible(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearPressTimer();
    if (longPressFired.current) {
      setTooltipVisible(false);
      return;
    }
    onSelect();
  };

  const handlePointerCancel = () => {
    clearPressTimer();
    setTooltipVisible(false);
  };

  return (
    <button
      type="button"
      className={`msb-item${isActive ? ' active' : ''}${expanded ? ' expanded' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="msb-icon">
        {icon}
        {badgeCount > 0 && <span className="ntf-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>}
      </span>
      {expanded ? <span className="msb-label">{label}</span> : <NavTooltip label={label} visible={tooltipVisible} />}
    </button>
  );
}
