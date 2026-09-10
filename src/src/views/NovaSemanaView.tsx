import { useState } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useHistoricoStore } from '../store/useHistoricoStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useUIStore } from '../store/useUIStore';
import { useCardioGoalStore } from '../store/useCardioGoalStore';
import { useAchievementStore } from '../store/useAchievementStore';
import { calcWeekTonnage, calcWeekVolume } from '../utils/volumeCalc';
import { countWeekWorkouts, getCardioWeekSummary, getEngajamentoBadge, getMotivationalPhrase } from '../utils/weekEngagement';
import type { HistoricoSemana } from '../types/history';
import { MUSCLE_COLOR } from '../data/muscleColors';
import '../components/dashboard/VolumeBar.css';
import './NovaSemanaView.css';

/**
 * Sucessor de #view-nova-semana + renderNovaSemana() (index.html
 * ~3267-3276, ~5443-5678): dashboard de fechamento motivacional + ações
 * de arquivar/zerar a semana. O bloco "⚡ Recordes de Força (1RM)" do
 * original não entrou — depende de strState.records (módulo Força, ainda
 * não portado); volta quando Força existir.
 */
export function NovaSemanaView() {
  const weekLog = useWorkoutStore((s) => s.weekLog);
  const weekPSE = useWorkoutStore((s) => s.weekPSE);
  const clearWeek = useWorkoutStore((s) => s.clearWeek);
  const exercises = useExerciseStore((s) => s.exercises);
  const historico = useHistoricoStore((s) => s.semanas);
  const arquivar = useHistoricoStore((s) => s.arquivar);
  const showToast = useUIStore((s) => s.showToast);
  const metaMin = useCardioGoalStore((s) => s.metaMin);

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const treinos = countWeekWorkouts(weekLog);
  const badge = getEngajamentoBadge(treinos);
  const cardio = getCardioWeekSummary(weekLog, exercises);
  const metaCardioOk = cardio.totalMin >= metaMin;
  const frase = getMotivationalPhrase(treinos, metaCardioOk);
  const weekVol = calcWeekVolume(weekLog, exercises);
  const topMuscles = Object.entries(weekVol)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .filter(([, v]) => v > 0);

  function selectHistWeek(idx: number) {
    setSelectedIdx((cur) => (cur === idx ? null : idx));
  }

  async function handleArquivar() {
    const ok = await useConfirmStore
      .getState()
      .ask('Salvar e arquivar esta semana? Os dados atuais serão movidos para o histórico e a semana será zerada.', {
        confirmLabel: 'Salvar e Arquivar',
      });
    if (!ok) return;

    const tonnageCalc = calcWeekTonnage(weekLog);
    const snapshot: HistoricoSemana = {
      id: new Date().toISOString(),
      data: new Date().toISOString(),
      weekLog: JSON.parse(JSON.stringify(weekLog)),
      weekPSE: { ...weekPSE },
      weekVol,
      tonnage: tonnageCalc.kg,
      sets: tonnageCalc.sets,
      cardio,
      treinos,
      badge,
    };
    arquivar(snapshot);
    useAchievementStore.getState().checkStreaks(snapshot, historico[0] ?? null);
    clearWeek();
    setSelectedIdx(null);
    showToast('✅ Semana arquivada! Novo ciclo iniciado 🚀', 'success');
  }

  async function handleZerar() {
    const ok = await useConfirmStore
      .getState()
      .ask('Tem certeza? Todos os dados da semana atual serão apagados sem salvar no histórico.', {
        confirmLabel: 'Zerar Semana',
        danger: true,
      });
    if (!ok) return;
    clearWeek();
    showToast('✅ Nova semana iniciada!', 'success');
  }

  const selected = selectedIdx != null ? historico[selectedIdx] : null;

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Nova Semana <span className="tag">RESET</span>
        </div>
      </div>

      <div className={`ns-hero ${badge.cls}`}>
        <div className="ns-badge">{badge.icon}</div>
        <div className="ns-badge-label">
          {badge.label} · {treinos} treino{treinos === 1 ? '' : 's'}
        </div>
        <div className="ns-motivational">{frase}</div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">❤️ Cardio Semanal</div>
        <div className="ns-cardio-grid">
          <div className="ns-stat-card">
            <div className="ns-stat-label">Volume Total</div>
            <div className="ns-stat-value">{cardio.totalMin} min</div>
            <div className="ns-stat-sub">{metaCardioOk ? '✅ Meta semanal atingida' : `Meta: ${metaMin} min/semana`}</div>
          </div>
          <div className="ns-stat-card">
            <div className="ns-stat-label">Maior Sessão</div>
            <div className="ns-stat-value">{cardio.maior ? `${cardio.maior.duration} min` : '—'}</div>
            <div className="ns-stat-sub">{cardio.maior ? `${cardio.maior.name} · ${cardio.maior.day}` : 'Nenhum cardio na semana'}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Resumo de Volume (Top 5)</div>
        {topMuscles.length === 0 ? (
          <div className="ns-history-empty">Nenhuma série registrada ainda esta semana.</div>
        ) : (
          topMuscles.map(([m, v]) => {
            const color = MUSCLE_COLOR[m as keyof typeof MUSCLE_COLOR] ?? '#888';
            return (
              <div className="vol-row" key={m}>
                <div className="vol-hdr">
                  <span className="vol-muscle" style={{ color }}>
                    {m}
                  </span>
                  <span className="vol-num">{v.toFixed(1)} séries</span>
                </div>
                <div className="vol-track">
                  <div className="vol-fill" style={{ width: `${Math.min(100, (v / 20) * 100)}%`, background: color }} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">📚 Histórico de Semanas</div>
        {historico.length === 0 ? (
          <div className="ns-history-empty">Nenhuma semana arquivada ainda.</div>
        ) : (
          <>
            <div className="ns-week-strip">
              {historico.slice(0, 8).map((h, idx) => (
                <button
                  key={h.id}
                  className={`ns-week-chip${selectedIdx === idx ? ' active' : ''}`}
                  title={`${h.treinos} treino${h.treinos === 1 ? '' : 's'}`}
                  onClick={() => selectHistWeek(idx)}
                >
                  <span>{h.badge.icon}</span>
                  <span className="ns-week-chip-dt">
                    {new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </button>
              ))}
            </div>

            <div className="ns-history-list">
              {historico.slice(0, 8).map((h, idx) => (
                <div
                  key={h.id}
                  className={`ns-history-item${selectedIdx === idx ? ' active' : ''}`}
                  onClick={() => selectHistWeek(idx)}
                >
                  <span>
                    {h.badge.icon} {new Date(h.data).toLocaleDateString('pt-BR')}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>
                      {h.treinos} treino{h.treinos === 1 ? '' : 's'} · {h.cardio.totalMin}min cardio
                    </span>
                    <span style={{ color: 'var(--teal)', fontSize: '0.68rem', fontWeight: 700 }}>
                      {selectedIdx === idx ? 'FECHAR ✕' : 'VER →'}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {selected && (
              <div className="ns-week-summary">
                <div className="card-title" style={{ marginBottom: 12 }}>
                  📅 Resumo · {new Date(selected.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </div>
                <div className={`ns-hero ${selected.badge.cls}`} style={{ padding: 16, marginBottom: 12 }}>
                  <div className="ns-badge" style={{ fontSize: '2.2rem' }}>
                    {selected.badge.icon}
                  </div>
                  <div className="ns-badge-label">
                    {selected.badge.label} · {selected.treinos} treino{selected.treinos === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="ns-cardio-grid">
                  <div className="ns-stat-card">
                    <div className="ns-stat-label">Cardio</div>
                    <div className="ns-stat-value">{selected.cardio.totalMin}min</div>
                    <div className="ns-stat-sub">{selected.cardio.maior ? selected.cardio.maior.name : 'Sem cardio na semana'}</div>
                  </div>
                  <div className="ns-stat-card">
                    <div className="ns-stat-label">Tonelagem</div>
                    <div className="ns-stat-value">{selected.tonnage.toFixed(0)}kg</div>
                    <div className="ns-stat-sub">Volume total levantado</div>
                  </div>
                </div>
                {Object.entries(selected.weekVol).filter(([, v]) => v > 0).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {Object.entries(selected.weekVol)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([m, v]) => (
                        <span className="tag" style={{ color: MUSCLE_COLOR[m as keyof typeof MUSCLE_COLOR] ?? '#888' }} key={m}>
                          {m} · {v.toFixed(1)}s
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <button className="btn btn-primary btn-full ns-save-btn" onClick={handleArquivar}>
        💾 Salvar e Arquivar Semana
      </button>
      <button className="btn btn-danger btn-full" style={{ marginTop: 10 }} onClick={handleZerar}>
        🔄 Zerar Sem Salvar
      </button>
    </div>
  );
}
