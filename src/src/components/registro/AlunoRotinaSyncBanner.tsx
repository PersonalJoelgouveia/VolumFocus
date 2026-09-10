import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useRotinaSyncStore } from '../../store/useRotinaSyncStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { fetchPublishedRotina } from '../../lib/alunoRepository';
import { buildWeekLogFromAlunoRotina } from '../../utils/importAlunoRotina';
import type { AlunoRotina } from '../../types/aluno';
import './AlunoRotinaSyncBanner.css';

function isWeekLogEmpty(weekLog: ReturnType<typeof useWorkoutStore.getState>['weekLog']): boolean {
  return Object.values(weekLog).every((dayLog) => !dayLog || dayLog.length === 0);
}

/**
 * Fecha o gap real que fazia rotinas publicadas "nunca aparecerem" pro
 * aluno: antes, a importação (utils/importAlunoRotina.ts) só existia
 * como um botão dentro de Minha Rotina — fácil de nunca ser descoberto.
 * Agora, ao abrir Treinos → Semana Atual:
 *
 * - Se o aluno ainda não tem NADA logado nesta semana, importa
 *   automaticamente e sem perguntar (não existe risco de sobrescrever
 *   progresso, porque não há progresso nenhum ainda).
 * - Se já existe algo logado, nunca sobrescreve sozinho — mostra este
 *   banner com a opção de importar agora ou ignorar.
 *
 * Compara `atualizadoEm` da rotina publicada com o que já foi visto
 * neste dispositivo (useRotinaSyncStore) — nunca importa nem avisa duas
 * vezes pra mesma versão publicada.
 */
export function AlunoRotinaSyncBanner() {
  const user = useAuthStore((s) => s.user);
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const showToast = useUIStore((s) => s.showToast);
  const exercises = useExerciseStore((s) => s.exercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const lastSeenAt = useRotinaSyncStore((s) => s.lastSeenAt);
  const setLastSeenAt = useRotinaSyncStore((s) => s.setLastSeenAt);

  const [pending, setPending] = useState<{ rotina: AlunoRotina; atualizadoEm: string } | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isAlunoMode || !user?.email) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await fetchPublishedRotina(user.email!);
        if (cancelled || !result) return;

        const version = result.atualizadoEm ?? 'sem-data';
        if (version === lastSeenAt) return; // já vista/tratada

        const weekLogAtual = useWorkoutStore.getState().weekLog;
        if (isWeekLogEmpty(weekLogAtual)) {
          // Nada logado ainda — seguro importar direto, sem perguntar.
          const { weekLog } = buildWeekLogFromAlunoRotina(result.rotina, exercises, addExercise);
          useWorkoutStore.setState({ weekLog });
          setLastSeenAt(version);
          showToast('✅ Sua rotina foi carregada automaticamente na Semana Atual!', 'success');
        } else {
          // Já existe progresso — nunca sobrescreve sozinho, só avisa.
          setPending({ rotina: result.rotina, atualizadoEm: version });
        }
      } catch (e) {
        console.error('AlunoRotinaSyncBanner: falha ao verificar rotina publicada', e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAlunoMode, user?.email]);

  if (!pending) return null;

  async function handleImportar() {
    if (!pending) return;
    const ok = await useConfirmStore.getState().ask(
      'Importar a rotina atualizada pelo seu Personal? Isso substitui o que já estiver registrado nos dias com exercícios prescritos.',
      { confirmLabel: 'Importar Agora' }
    );
    if (!ok) return;

    setImporting(true);
    try {
      const { weekLog, novosExercicios } = buildWeekLogFromAlunoRotina(pending.rotina, exercises, addExercise);
      const current = useWorkoutStore.getState().weekLog;
      useWorkoutStore.setState({ weekLog: { ...current, ...weekLog } });
      setLastSeenAt(pending.atualizadoEm);
      const extra = novosExercicios.length ? ` (${novosExercicios.length} exercício(s) novo(s) criado(s) no banco)` : '';
      showToast(`✅ Rotina importada!${extra}`, 'success');
      setPending(null);
    } catch (e) {
      console.error('AlunoRotinaSyncBanner: falha ao importar', e);
      showToast('⚠️ Não foi possível importar a rotina.', 'error');
    } finally {
      setImporting(false);
    }
  }

  function handleDispensar() {
    if (!pending) return;
    setLastSeenAt(pending.atualizadoEm);
    setPending(null);
  }

  return (
    <div className="rotina-sync-banner">
      <span className="rotina-sync-icon">🔔</span>
      <div className="rotina-sync-text">
        <strong>Seu Personal atualizou sua rotina.</strong> Quer importar pra Semana Atual agora?
      </div>
      <div className="rotina-sync-actions">
        <button className="btn btn-ghost btn-sm" onClick={handleDispensar} disabled={importing}>
          Agora não
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleImportar} disabled={importing}>
          {importing ? 'Importando…' : 'Importar Agora'}
        </button>
      </div>
    </div>
  );
}
