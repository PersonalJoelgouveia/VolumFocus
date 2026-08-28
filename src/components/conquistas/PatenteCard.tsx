import type { StreakDef } from '../../data/achievements';
import { getNextRank, getRank } from '../../data/achievements';
import type { StreakState } from '../../types/achievement';

interface PatenteCardProps {
  streakDef: StreakDef;
  state: StreakState;
}

/** Sucessor de renderPatenteCard() (index.html ~8162-8181). */
export function PatenteCard({ streakDef, state }: PatenteCardProps) {
  const r = getRank(state.best);
  const next = getNextRank(state.best);
  const icon = r ? r.icon : streakDef.baseIcon;
  const name = r ? r.name : 'Sem Patente';
  const color = r ? r.color : 'var(--text-3)';
  const restante = next ? Math.max(0, next.weeks - state.current) : 0;
  const pct = next ? Math.min(100, Math.round((state.current / next.weeks) * 100)) : 100;

  return (
    <div className={`ach-badge-card ach-patente-card${r ? ' ach-unlocked' : ' ach-locked'}`}>
      {r && <div className="ach-unlocked-dot" />}
      <div className="ach-badge-icon" style={{ background: `${color}22` }}>
        {icon}
      </div>
      <div className="ach-badge-name">
        {streakDef.name}
        {r ? ` · ${name}` : ''}
      </div>
      <div className="ach-badge-desc">{streakDef.desc}</div>
      <div className={`ach-badge-rec${r ? '' : ' ach-rec-locked'}`}>
        {state.current} semana{state.current === 1 ? '' : 's'} atual · recorde {state.best}
      </div>
      {next ? (
        <>
          <div className="ach-patente-bar">
            <div className="ach-patente-fill" style={{ width: `${pct}%`, background: next.color }} />
          </div>
          <div className="ach-patente-next">
            Próxima: {next.icon} {next.name} em {restante} sem.
          </div>
        </>
      ) : (
        <div className="ach-patente-next" style={{ color: 'var(--teal)' }}>
          🏆 Patente máxima atingida!
        </div>
      )}
    </div>
  );
}
