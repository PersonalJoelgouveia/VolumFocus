import { useCallback, useEffect, useState } from 'react';
import { useAlunoStore } from '../store/useAlunoStore';
import { useAuthStore } from '../store/useAuthStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useUIStore } from '../store/useUIStore';
import { createAssessment, deleteAssessment, listAssessments, updateAssessment } from '../lib/physicalAssessmentRepository';
import type { PhysicalAssessment } from '../types/assessment';

export interface UsePhysicalAssessments {
  loading: boolean;
  error: string | null;
  retry: () => void;
  /** true só para o Personal (role === 'personal') — trava de UX; a
   *  garantia de verdade são as regras do Firestore. */
  canWrite: boolean;
  salvar: (assessment: PhysicalAssessment) => Promise<boolean>;
  editar: (assessmentId: string, patch: Partial<PhysicalAssessment>) => Promise<boolean>;
  /** Pede confirmação (useConfirmStore) antes de remover. */
  remover: (assessmentId: string) => Promise<void>;
}

/**
 * Ponte entre o histórico local (useAlunoStore — sempre disponível, "zero
 * UI lag") e a persistência em nuvem (physicalAssessmentRepository).
 *
 * Atualização otimista em toda escrita: muda o estado local primeiro,
 * chama o Firestore depois; se a nuvem falhar, desfaz a mudança local e
 * avisa por toast (useUIStore.showToast — mesmo mecanismo de toast já
 * usado no resto do app, não um componente novo).
 */
export function usePhysicalAssessments(alunoId: string): UsePhysicalAssessments {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const assessments = useAlunoStore((s) => s.getAvaliacoes(alunoId));
  const setAvaliacoes = useAlunoStore((s) => s.setAvaliacoes);
  const addAvaliacao = useAlunoStore((s) => s.addAvaliacao);
  const updateAvaliacao = useAlunoStore((s) => s.updateAvaliacao);
  const removeAvaliacao = useAlunoStore((s) => s.removeAvaliacao);

  const canWrite = useAuthStore((s) => s.role === 'personal');
  const showToast = useUIStore((s) => s.showToast);
  const ask = useConfirmStore((s) => s.ask);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const email = aluno?.email;

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    listAssessments(email)
      .then((remotas) => {
        if (!cancelled) setAvaliacoes(alunoId, remotas);
      })
      .catch((e) => {
        console.error('usePhysicalAssessments: falha ao carregar histórico', e);
        if (!cancelled) setError('Não foi possível carregar o histórico de avaliações.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, alunoId, setAvaliacoes, tentativa]);

  const retry = useCallback(() => setTentativa((n) => n + 1), []);

  const salvar = useCallback(
    async (assessment: PhysicalAssessment): Promise<boolean> => {
      if (!canWrite) {
        showToast('Só o Personal Trainer pode registrar avaliações.', 'error');
        return false;
      }
      if (!email) {
        showToast('Aluno sem e-mail cadastrado — não é possível salvar na nuvem.', 'error');
        return false;
      }

      addAvaliacao(alunoId, assessment); // otimista

      try {
        await createAssessment(email, assessment);
        showToast('Avaliação salva!', 'success');
        return true;
      } catch (e) {
        console.error('usePhysicalAssessments: falha ao salvar avaliação', e);
        removeAvaliacao(alunoId, assessment.id); // desfaz o otimista
        showToast('Não foi possível salvar na nuvem. Tente novamente.', 'error');
        return false;
      }
    },
    [canWrite, email, alunoId, addAvaliacao, removeAvaliacao, showToast]
  );

  const editar = useCallback(
    async (assessmentId: string, patch: Partial<PhysicalAssessment>): Promise<boolean> => {
      if (!canWrite || !email) return false;

      const anterior = assessments.find((a) => a.id === assessmentId);
      updateAvaliacao(alunoId, assessmentId, patch); // otimista

      try {
        await updateAssessment(email, assessmentId, patch);
        showToast('Avaliação atualizada!', 'success');
        return true;
      } catch (e) {
        console.error('usePhysicalAssessments: falha ao atualizar avaliação', e);
        if (anterior) updateAvaliacao(alunoId, assessmentId, anterior); // desfaz
        showToast('Não foi possível atualizar. Tente novamente.', 'error');
        return false;
      }
    },
    [canWrite, email, alunoId, assessments, updateAvaliacao, showToast]
  );

  const remover = useCallback(
    async (assessmentId: string): Promise<void> => {
      if (!canWrite || !email) {
        showToast('Só o Personal Trainer pode remover avaliações.', 'error');
        return;
      }

      const confirmado = await ask('Remover esta avaliação? Essa ação não pode ser desfeita.', {
        confirmLabel: 'Remover',
        danger: true,
      });
      if (!confirmado) return;

      const removida = assessments.find((a) => a.id === assessmentId);
      removeAvaliacao(alunoId, assessmentId); // otimista

      try {
        await deleteAssessment(email, assessmentId);
        showToast('Avaliação removida.', 'success');
      } catch (e) {
        console.error('usePhysicalAssessments: falha ao remover avaliação', e);
        if (removida) addAvaliacao(alunoId, removida); // desfaz
        showToast('Não foi possível remover. Tente novamente.', 'error');
      }
    },
    [canWrite, email, alunoId, assessments, ask, removeAvaliacao, addAvaliacao, showToast]
  );

  return { loading, error, retry, canWrite, salvar, editar, remover };
}
