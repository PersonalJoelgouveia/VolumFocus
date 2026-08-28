import type { MuscleGroup } from '../../types/exercise';
import { MUSCLE_COLOR } from '../../data/muscleColors';
import './VolumeBar.css';

interface VolumeBarProps {
  muscle: MuscleGroup;
  value: number;
  maxForFill: number;
  min: number;
  max: number;
}

/**
 * Linha de volume por músculo — sucessora do template `.vol-row` inline
 * gerado em renderDashboard() (index.html ~4746-4749).
 * Status: 'abaixo' (< meta mín.), 'ok' (dentro da faixa), 'acima' (> meta máx.).
 */
export function VolumeBar({ muscle, value, maxForFill, min, max }: VolumeBarProps) {
  const pct = Math.min(100, Math.round((value / maxForFill) * 100));
  const status = value < min ? 'abaixo' : value <= max ? 'ok' : 'acima';
  const statusColor =
    status === 'abaixo' ? 'var(--text-3)' : status === 'ok' ? 'var(--teal)' : 'var(--orange)';
  const barColor = MUSCLE_COLOR[muscle] ?? '#888';

  return (
    <div className="vol-row">
      <div className="vol-hdr">
        <span className="vol-muscle" style={{ color: barColor }}>
          {muscle}
        </span>
        <span className="vol-num">{value.toFixed(1)} séries</span>
      </div>
      <div className="vol-track">
        <div className="vol-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="vol-status">
        <div className="vol-dot" style={{ background: statusColor }} />
        <span style={{ color: statusColor }}>{status}</span>
      </div>
    </div>
  );
}
