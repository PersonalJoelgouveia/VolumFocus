import { useAchievementStore } from '../store/useAchievementStore';
import { RECORD_BADGES, STREAKS } from '../data/achievements';
import type { RecordCategory } from '../types/achievement';
import { FireCard } from '../components/conquistas/FireCard';
import { PatenteCard } from '../components/conquistas/PatenteCard';
import { RecordBadgeCard } from '../components/conquistas/RecordBadgeCard';
import '../components/conquistas/ConquistasView.css';

const CATEGORIES: { label: string; cat: RecordCategory }[] = [
  { label: '💪 Força', cat: 'forca' },
  { label: '🏃 Cardio', cat: 'cardio' },
  { label: '🔥 Misto', cat: 'misto' },
];

/**
 * Sucessor de #view-conquistas + ach.render() (index.html ~3279-3300,
 * ~8194-8226): ofensiva diária (Fire), estatísticas de progresso,
 * patentes semanais (4 insígnias de streak) e recordes pessoais por
 * categoria.
 *
 * Dos 5 badges de recorde, só "Titã do Powerlifting" (carga máxima) e
 * "Fornalha Calórica" (kcal/sessão) têm dado de origem hoje — os outros
 * 3 (Pace de Ouro, Ultra Resistência, Eficiência Aeróbica) dependem de
 * distância/FC média por sessão de cardio, que o registro de cardio
 * atual (duração + intensidade percebida) não captura. Os cards
 * continuam aparecendo — só nunca desbloqueiam até esse dado existir.
 */
export function ConquistasView() {
  const streaks = useAchievementStore((s) => s.streaks);
  const records = useAchievementStore((s) => s.records);

  const totalUnlocked = Object.keys(records).length + STREAKS.filter((s) => streaks[s.id].best > 0).length;
  const totalBadges = RECORD_BADGES.length + STREAKS.length;
  const pct = totalBadges > 0 ? Math.round((totalUnlocked / totalBadges) * 100) : 0;

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Conquistas <span className="tag">RECORDES & PATENTES</span>
        </div>
      </div>

      <FireCard />

      <div className="cgrid-stats-row">
        <div className="cgrid-stat">
          <div className="cgrid-stat-val">{totalUnlocked}</div>
          <div className="cgrid-stat-lbl">🏆 Desbloqueadas</div>
        </div>
        <div className="cgrid-stat">
          <div className="cgrid-stat-val">{totalBadges - totalUnlocked}</div>
          <div className="cgrid-stat-lbl">🔒 Bloqueadas</div>
        </div>
        <div className="cgrid-stat">
          <div className="cgrid-stat-val" style={{ color: 'var(--orange)' }}>
            {pct}%
          </div>
          <div className="cgrid-stat-lbl">📊 Progresso</div>
        </div>
      </div>

      <div className="ach-cat-row">
        <div className="ach-cat-label">📈 Patentes Semanais</div>
        <div className="ach-cat-line" />
      </div>
      <div className="ach-grid" style={{ marginBottom: 6 }}>
        {STREAKS.map((s) => (
          <PatenteCard key={s.id} streakDef={s} state={streaks[s.id]} />
        ))}
      </div>

      {CATEGORIES.map(({ label, cat }) => {
        const badges = RECORD_BADGES.filter((b) => b.cat === cat);
        if (!badges.length) return null;
        return (
          <div key={cat}>
            <div className="ach-cat-row">
              <div className="ach-cat-label">{label}</div>
              <div className="ach-cat-line" />
            </div>
            <div className="ach-grid" style={{ marginBottom: 6 }}>
              {badges.map((b) => (
                <RecordBadgeCard key={b.id} badge={b} rec={records[b.id]} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
