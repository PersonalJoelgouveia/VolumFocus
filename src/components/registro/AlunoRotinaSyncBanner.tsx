import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import { useRotinaSyncStore } from '../../store/useRotinaSyncStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { resolverRotinaAtivaDoAluno } from '../../lib/rotinaAtivaAluno';
import type { RotinaAtivaResolvida } from '../../lib/rotinaAtivaAluno';
import { decidirSincronizacao } from '../../utils/rotinaSync';
import { aplicarRotinaNaSemana } from '../../utils/aplicarRotinaNaSemana';
import './AlunoRotinaSyncBanner.css';

/**
 * Sincroniza a ROTINA ATIVA do aluno (`ativa === true` em `alunos/{email}/rotinas`;
 * legado `alunos/{email}.rotina` só se ele não tem rotinas — ver lib/rotinaAtivaAluno)
 * com Treinos → Semana Atual. Verifica ao abrir Treinos e ao voltar para o app.
 *
 * Quando o Personal troca a rotina ativa (a "versão" muda):
 * - Semana vazia, ou SEM progresso e ainda idêntica à última importada (o aluno
 *   não mexeu em nada): a nova rotina vira a semana, sem perguntar.
 * - Qualquer progresso (série/exercício concluído, PSE, cardio medido) ou edição
 *   do aluno: NUNCA sobrescreve sozinho — mostra este banner (importar / agora não).
 *
 * Nunca importa nem avisa duas vezes para a mesma versão (useRotinaSyncStore).
 * Rotinas históricas não são tocadas: só lê.
 */
export function AlunoRotinaSyncBanner() {
  const user = useAuthStore((s) => s.user);
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const showToast = useUIStore((s) => s.showToast);
  const exercises = useExerciseStore((s) => s.exercises);
  const addExercise = useExerciseStore((s) => s.addExercise);
  const setLastSeenAt = useRotinaSyncStore((s) => s.setLastSeenAt);

  const [pending, setPending] = useState<RotinaAtivaResolvida | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isAlunoMode || !user?.email) return;
    let cancelled = false;
    let rodando = false;

    async function verificar() {
      if (rodando) return;
      rodando = true;
      try {
        const resolvida = await resolverRotinaAtivaDoAluno();
        if (cancelled || !resolvida) return;
        // Estado lido AGORA (não o capturado na montagem): o aluno pode ter treinado desde então.
        const sync = useRotinaSyncStore.getState();
        if (resolvida.version === sync.lastSeenAt) return; // já vista/tratada

        const w = useWorkoutStore.getState();
        const bancoAtual = useExerciseStore.getState().exercises;
        const decisao = decidirSincronizacao({
          weekLog: w.weekLog,
          exDone: w.exDone,
          weekPSE: w.weekPSE,
          exercises: bancoAtual,
          fingerprintImportada: sync.lastImportedFingerprint,
        });

        if (decisao === 'substituir') {
          aplicarRotinaNaSemana(resolvida, bancoAtual, useExerciseStore.getState().addExercise, 'substituir-semana');
          setPending(null);
          showToast(
            resolvida.nome
              ? `✅ Sua rotina atual "${resolvida.nome}" foi carregada na Semana Atual!`
              : '✅ Sua rotina foi carregada automaticamente na Semana Atual!',
            'success'
          );
        } else {
          setPending(resolvida);
        }
      } catch (e) {
        console.error('AlunoRotinaSyncBanner: falha ao verificar rotina ativa', e);
      } finally {
        rodando = false;
      }
    }

    // Offline/sem rede: a verificação falha em silêncio e a Semana Atual local segue intacta.
    void verificar();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void verificar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [isAlunoMode, user?.email, showToast]);

  async function handleImportar() {
    if (!pending) return;
    const ok = await useConfirmStore.getState().ask(
      'Importar a rotina atual definida pelo seu Personal? Isso substitui o que já estiver registrado nos dias com exercícios prescritos (e zera o progresso desses dias).',
      { confirmLabel: 'Importar Agora' }
    );
    if (!ok) return;

    setImporting(true);
    try {
      const { novosExercicios } = aplicarRotinaNaSemana(pending, exercises, addExercise, 'mesclar-dias');
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
    setLastSeenAt(pending.version);
    setPending(null);
  }

  if (!pending) return null;

  return (
    <div className="rotina-sync-banner">
      <span className="rotina-sync-icon">🔔</span>
      <div className="rotina-sync-text">
        <strong>
          {pending.nome ? `Seu Personal definiu a rotina atual "${pending.nome}".` : 'Seu Personal atualizou sua rotina.'}
        </strong>{' '}
        Sua Semana Atual já tem treino registrado, então ela não foi aplicada. Quer importar agora?
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
