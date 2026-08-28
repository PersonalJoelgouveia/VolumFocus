import { getFireDisplayState, useAchievementStore } from '../../store/useAchievementStore';

/** Sucessor de renderFireCard() (index.html ~8182-8193). */
export function FireCard() {
  const fire = useAchievementStore((s) => s.fire);
  const f = getFireDisplayState(fire);

  return (
    <div className={`ach-fire-card${f.current > 0 ? ' ach-fire-active' : ''}`}>
      <div className="ach-fire-icon">🔥</div>
      <div>
        <span className="ach-fire-num">{f.current}</span>
        <span className="ach-fire-lbl">dia{f.current === 1 ? '' : 's'} on fire</span>
        {!f.checkedToday && f.current > 0 && <div className="ach-fire-warn">⚠️ Treine hoje pra não perder a ofensiva</div>}
      </div>
      <div className="ach-fire-best">
        🏆 recorde
        <br />
        {f.best} dia{f.best === 1 ? '' : 's'}
      </div>
    </div>
  );
}
