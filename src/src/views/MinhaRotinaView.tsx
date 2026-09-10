import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useUIStore } from '../store/useUIStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { DAYS, DAYS_SHORT } from '../types/workout';
import { isAlunoExercicioCardio } from '../types/aluno';
import type { AlunoRotina } from '../types/aluno';
import { fetchPublishedRotina } from '../lib/alunoRepository';
import { buildWeekLogFromAlunoRotina } from '../utils/importAlunoRotina';
import '../components/clientes/ClientesView.css';

type LoadState = 'loading' | 'error' | 'empty' | 'ready';

/**
 * View exclusiva do aluno — sucessora do lado "aluno" de
 * cli_tentarCarregarRotinaPublicada() (index.html ~11191-11210): busca
 * `alunos/{email}.rotina` (o próprio e-mail logado, nunca outro) e mostra
 * em modo leitura, mesmo componente visual do AlunoDetailModal do Personal
 * (dias + lista de exercícios), sem edição.
 *
 * Sempre lê direto do Firestore ao montar — não guarda cópia local — para
 * garantir que reload/relogin sempre reflitam a última publicação do
 * Personal, sem estado obsoleto.
 */
export function MinhaRotinaView() {
  const user = useAuthStore((s) => s.user);
  const exercises = useExerciseStore((s) => s.exercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const showToast = useUIStore((s) => s.showToast);

  const [state, setState] = useState<LoadState>('loading');
  const [rotina, setRotina] = useState<AlunoRotina | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [importing, setImporting] = useState(false);

  async function load() {
    if (!user?.email) return;
    setState('loading');
    try {
      const result = await fetchPublishedRotina(user.email);
      if (!result) {
        setState('empty');
        return;
      }
      setRotina(result.rotina);
      setAtualizadoEm(result.atualizadoEm);
      const firstWithExercicios = result.rotina.findIndex((d) => d.exercicios.length > 0);
      setActiveDay(firstWithExercicios >= 0 ? firstWithExercicios : 0);
      setState('ready');
    } catch (e) {
      console.error('MinhaRotinaView: falha ao carregar rotina publicada', e);
      setState('error');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  async function handleImportar() {
    if (!rotina) return;
    const totalExercicios = rotina.reduce((n, d) => n + d.exercicios.length, 0);
    if (!totalExercicios) return;

    const ok = await useConfirmStore.getState().ask(
      `Importar esta rotina para Treinos → Semana Atual? Isso substitui o que já estiver registrado nos dias com exercícios prescritos.`,
      { confirmLabel: 'Importar Rotina' }
    );
    if (!ok) return;

    setImporting(true);
    try {
      const { weekLog, novosExercicios } = buildWeekLogFromAlunoRotina(rotina, exercises, addExercise);
      const current = useWorkoutStore.getState().weekLog;
      useWorkoutStore.setState({ weekLog: { ...current, ...weekLog } });

      const extra = novosExercicios.length
        ? ` (${novosExercicios.length} exercício${novosExercicios.length === 1 ? '' : 's'} novo${novosExercicios.length === 1 ? '' : 's'} criado${novosExercicios.length === 1 ? '' : 's'} no banco)`
        : '';
      showToast(`✅ Rotina importada para a Semana Atual!${extra}`, 'success');
    } catch (e) {
      console.error('MinhaRotinaView: falha ao importar rotina', e);
      showToast('⚠️ Não foi possível importar a rotina.', 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Minha Rotina <span className="tag">TREINO DO PERSONAL</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={state === 'loading'}>
          {state === 'loading' ? 'Atualizando…' : '🔄 Atualizar'}
        </button>
      </div>

      {state === 'loading' && <div className="cli-empty">Carregando sua rotina…</div>}

      {state === 'error' && (
        <div className="cli-empty">
          ⚠️ Não foi possível carregar sua rotina agora. Confira a conexão e toque em "Atualizar".
        </div>
      )}

      {state === 'empty' && (
        <div className="cli-empty">
          Seu Personal ainda não publicou uma rotina para você. Assim que publicar, ela aparece aqui automaticamente
          na próxima atualização.
        </div>
      )}

      {state === 'ready' && rotina && (
        <>
          {atualizadoEm && (
            <div className="cli-last" style={{ marginBottom: 14 }}>
              Publicada em: {new Date(atualizadoEm).toLocaleString('pt-BR')}
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            style={{ marginBottom: 16 }}
            onClick={handleImportar}
            disabled={importing || rotina.every((d) => d.exercicios.length === 0)}
          >
            {importing ? 'Importando…' : '📥 Importar Rotina para Semana Atual'}
          </button>

          <div className="cli-days-bar">
            {DAYS_SHORT.map((label, d) => {
              const count = rotina[d].exercicios.length;
              return (
                <button
                  key={label}
                  className={`cli-day-btn${activeDay === d ? ' active' : ''}`}
                  onClick={() => setActiveDay(d)}
                >
                  <div className="cli-dl">{label}</div>
                  <div className="cli-ds">{count > 0 ? `${count}ex` : '-'}</div>
                </button>
              );
            })}
          </div>

          <div className="cli-day-type">
            {DAYS[activeDay]} — {rotina[activeDay].tipo}
          </div>

          <div className="cli-ex-list">
            {rotina[activeDay].exercicios.length === 0 ? (
              <div className="cli-rest-day">💤 Dia de descanso — nenhum exercício programado.</div>
            ) : (
              rotina[activeDay].exercicios.map((ex, i) => (
                <div className="cli-ex-item" key={i}>
                  <div className="cli-ex-info">
                    <div className="cli-ex-name" title={ex.nome}>
                      {ex.nome}
                    </div>
                    <div className="cli-ex-detail">
                      {isAlunoExercicioCardio(ex) ? (
                        <>
                          <span className="cli-ex-chip">{ex.duracao}</span>
                          <span className="cli-ex-chip">Intensidade: {ex.intensidade}</span>
                        </>
                      ) : (
                        <>
                          <span className="cli-ex-chip">
                            {ex.series}×{ex.reps}
                          </span>
                          <span className="cli-ex-chip">{ex.carga}kg</span>
                          {ex.rir != null && <span className="cli-ex-chip">RIR {ex.rir}</span>}
                          {ex.sugestao && <span className="cli-ex-chip cli-ex-chip-sug">▲ {ex.sugestao}kg</span>}
                        </>
                      )}
                    </div>
                    {ex.notes && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--teal)', marginTop: 6, fontStyle: 'italic' }}>
                        # {ex.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
