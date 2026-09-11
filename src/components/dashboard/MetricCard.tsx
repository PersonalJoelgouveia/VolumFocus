import { memo, type ReactNode } from 'react';
import './MetricCard.css';

interface MetricCardProps {
  icon: string;
  label: string;
  value: ReactNode;
  unit?: string;
  footer?: ReactNode;
}

/**
 * Card de métrica genérico — sucessor do template `.conquest-card` gerado
 * como string HTML em renderDashboard() (index.html ~4730-4737).
 * Todo o conteúdo dinâmico passa como children/props do React (texto),
 * nunca via innerHTML — elimina por construção a classe de risco XSS que
 * motivou o helper esc() no monolito (ver nota de segurança no README).
 *
 * Memoizado — usado em grids de até 6+ cards (Saúde & Wearables, etc.) que
 * re-renderizam a cada tick de sincronização; sem memo, cada card refaz
 * o mesmo DOM mesmo com props idênticas.
 */
export const MetricCard = memo(function MetricCard({ icon, label, value, unit, footer }: MetricCardProps) {
  return (
    <div className="conquest-card">
      <span className="cq-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="cq-label">{label}</div>
      <div className="cq-value">{value}</div>
      {unit && <div className="cq-unit">{unit}</div>}
      {footer}
    </div>
  );
});
