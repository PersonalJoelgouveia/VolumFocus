import { useCallback, useEffect, useState } from 'react';
import { useAlunoStore } from '../store/useAlunoStore';
import { useAuthStore } from '../store/useAuthStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useUIStore } from '../store/useUIStore';
import { createNote, deleteNote, listNotesByAluno, updateNote } from '../lib/trainingNotesRepository';
import type { TrainingNote } from '../types/trainingNote';

export interface UseTrainingNotes {
  notes: TrainingNote[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  /** true só para o Personal — trava de UX; a garantia de verdade são as
   *  regras do Firestore (aluno não tem `allow` nenhum em `anotacoes`). */
  canWrite: boolean;
  /** Cria a anotação (otimista) e retorna `true` se a subida deu certo. */
  criar: (nota: TrainingNote) => Promise<boolean>;
  /** Autosave de conteúdo — sem toast de sucesso (silencioso, ver status
   *  próprio do editor) nem confirmação; toast só no erro. */
  salvarConteudo: (noteId: string, conteudo: string) => Promise<boolean>;
  /** Pede confirmação (useConfirmStore) antes de remover. */
  remover: (noteId: string) => Promise<void>;
}

/**
 * Ponte entre o histórico local (useAlunoStore.notas — sempre disponível,
 * "zero UI lag") e a persistência em nuvem (trainingNotesRepository).
 * Mesma estratégia de atualização otimista de usePhysicalAssessments.ts:
 * muda o estado local primeiro, chama o Firestore depois; desfaz se falhar.
 */
export function useTrainingNotes(alunoId: string): UseTrainingNotes {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const notes = useAlunoStore((s) => s.getNotas(alunoId));
  const setNotas = useAlunoStore((s) => s.setNotas);
  const addNota = useAlunoStore((s) => s.addNota);
  const updateNota = useAlunoStore((s) => s.updateNota);
  const removeNota = useAlunoStore((s) => s.removeNota);

  const canWrite = useAuthStore((s) => s.role === 'personal');
  const showToast = useUIStore((s) => s.showToast);
  const ask = useConfirmStore((s) => s.ask);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const email = aluno?.email;

  useEffect(() => {
    if (!email || !canWrite) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    listNotesByAluno(email)
      .then((remotas) => {
        if (!cancelled) setNotas(alunoId, remotas);
      })
      .catch((e) => {
        console.error('useTrainingNotes: falha ao carregar histórico', e);
        if (!cancelled) setError('Não foi possível carregar o histórico de anotações.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, canWrite, alunoId, setNotas, tentativa]);

  const retry = useCallback(() => setTentativa((n) => n + 1), []);

  const criar = useCallback(
    async (nota: TrainingNote): Promise<boolean> => {
      if (!canWrite) {
        showToast('Só o Personal Trainer pode criar anotações.', 'error');
        return false;
      }
      if (!email) {
        showToast('Aluno sem e-mail cadastrado — não é possível salvar na nuvem.', 'error');
        return false;
      }

      addNota(alunoId, nota); // otimista

      try {
        await createNote(email, nota);
        return true;
      } catch (e) {
        console.error('useTrainingNotes: falha ao criar anotação', e);
        removeNota(alunoId, nota.id); // desfaz o otimista
        showToast('Não foi possível salvar a anotação. Tente novamente.', 'error');
        return false;
      }
    },
    [canWrite, email, alunoId, addNota, removeNota, showToast]
  );

  const salvarConteudo = useCallback(
    async (noteId: string, conteudo: string): Promise<boolean> => {
      if (!canWrite || !email) return false;

      const atualizadoEm = new Date().toISOString();
      updateNota(alunoId, noteId, { conteudo, updatedAt: atualizadoEm }); // otimista

      try {
        await updateNote(email, noteId, { conteudo, updatedAt: atualizadoEm });
        return true;
      } catch (e) {
        console.error('useTrainingNotes: falha ao salvar anotação', e);
        return false;
      }
    },
    [canWrite, email, alunoId, updateNota]
  );

  const remover = useCallback(
    async (noteId: string): Promise<void> => {
      if (!canWrite || !email) {
        showToast('Só o Personal Trainer pode remover anotações.', 'error');
        return;
      }

      const confirmado = await ask('Remover esta anotação? Essa ação não pode ser desfeita.', {
        confirmLabel: 'Remover',
        danger: true,
      });
      if (!confirmado) return;

      const removida = notes.find((n) => n.id === noteId);
      removeNota(alunoId, noteId); // otimista

      try {
        await deleteNote(email, noteId);
        showToast('Anotação removida.', 'success');
      } catch (e) {
        console.error('useTrainingNotes: falha ao remover anotação', e);
        if (removida) addNota(alunoId, removida); // desfaz
        showToast('Não foi possível remover. Tente novamente.', 'error');
      }
    },
    [canWrite, email, alunoId, notes, ask, removeNota, addNota, showToast]
  );

  return { notes, loading, error, retry, canWrite, criar, salvarConteudo, remover };
}
