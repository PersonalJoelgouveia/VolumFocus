import type { RecordBadgeDef } from '../../types/achievement';
import type { RecordEntry } from '../../types/achievement';

interface RecordBadgeCardProps {
  badge: RecordBadgeDef;
  rec: RecordEntry | undefined;
}

/** Sucessor do card de badge de recorde pessoal dentro de render() (index.html ~8213-8221). */
export function RecordBadgeCard({ badge, rec }: RecordBadgeCardProps) {
  const unlocked = !!rec;
  return (
    <div className={`ach-badge-card${unlocked ? ' ach-unlocked' : ' ach-locked'}`}>
      {unlocked && <div className="ach-unlocked-dot" />}
      <div className="ach-badge-icon" style={{ background: `${badge.color}22` }}>
        {badge.icon}
      </div>
      <div className="ach-badge-name">{badge.name}</div>
      <div className="ach-badge-desc">{badge.desc}</div>
      <div className={`ach-badge-rec${unlocked ? '' : ' ach-rec-locked'}`}>
        {unlocked ? badge.format(rec.value) : '— Sem recorde'}
      </div>
      {unlocked && <div className="ach-badge-date">{rec.date}</div>}
    </div>
  );
}
