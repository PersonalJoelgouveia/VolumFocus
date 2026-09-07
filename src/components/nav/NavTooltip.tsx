interface NavTooltipProps {
  label: string;
  visible: boolean;
}

/**
 * Tooltip do NavItem — revelado por toque-e-retenção (long-press) sobre um
 * ícone da MobileSidebar em modo icon-only. Puramente apresentacional: quem
 * decide `visible` é o NavItem (timer de retenção). Fica sempre no DOM (não
 * condicional) para permitir transição de entrada/saída via CSS a partir da
 * classe `.visible`, em vez de aparecer/sumir abruptamente.
 */
export function NavTooltip({ label, visible }: NavTooltipProps) {
  return (
    <span className={`nav-tooltip${visible ? ' visible' : ''}`} role="tooltip" aria-hidden={!visible}>
      {label}
    </span>
  );
}
