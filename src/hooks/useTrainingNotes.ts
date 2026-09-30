import { useCallback, useEffect, useRef, useState } from 'react';
import { useAlunoStore } from '../store/useAlunoStore';
import { useAuthStore } from '../store/useAuthStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useUIStore } from '../store/useUIStore';
import { createNote, deleteNote, listNotesByAlunoPage, updateNote } from '../lib/trainingNotesRepository';
import type { TrainingNote } from '../types/trainingNote';

/** Tamanho de página do histórico — ver doc de `listNotesByAlunoPage`
 *  (trainingNotesRepository.ts) pra por que a lista nunca é buscada
 *  inteira de uma vez. */
const PAGE_SIZE = 20;

export interface UseTrainingNotes {
  /** Só as anotações já carregadas até agora (primeira página + páginas
   *  seguintes pedidas via `carregarMais`) — nunca o histórico inteiro de
   *  uma só vez. */
  notes: TrainingNote[];
  loading: boolean;
  /** true durante uma chamada a `carregarMais` (distinto de `loading`,
   *  que é só a carga inicial — a UI usa isso pro botão "Carregar mais"). */
  loadingMore: boolean;
  /** true se a página mais recente veio cheia — provavelmente há mais
   *  anotações além das já carregadas. */
  hasMore: boolean;
  error: string | null;
  retry: () => void;
  /** Busca a próxima página e ACRESCENTA ao que já está carregado — nunca
   *  substitui. Não faz nada se já estiver carregando ou se `hasMore` for
   *  falso. */
  carregarMais: () => void;
  /** true só para o Personal — trava de UX; a garantia de verdade são as
   *  regras do Firestore (aluno não tem `allow` nenhum em `anotacoes`). */
  canWrite: boolean;
  /** Cria a anotação (otimista) e retorna `true` se a subida deu certo. */
  criar: (nota: TrainingNote) => Promise<boolean>;
  /** Salva conteúdo editado (autosave). Sem toast em sucesso OU falha —
   *  silencioso de propósito: o NoteEditor já mostra "Salvando…"/"Salvo"/
   *  "Não sincronizado" e tenta de novo sozinho (timer + evento `online`),
   *  então um toast a cada nova tentativa falha viraria spam. Quem quiser
   *  reagir ao retorno (`false`) pode — o hook só não notifica por conta
   *  própria aqui. */
  salvarConteudo: (noteId: string, conteudo: string) => Promise<boolean>;
  /** Pede confirmação (useConfirmStore) antes de remover. */
  remover: (noteId: string) => Promise<void>;
}

/**
 * Ponte entre o histórico local (useAlunoStore.notas — sempre disponível,
 * "zero UI lag") e a persistência em nuvem (trainingNotesRepository).
 * Mesma estratégia de atualização otimista de usePhysicalAssessments.ts:
 * muda o estado local primeiro, chama o Firestore depois; desfaz se falhar.
 *
 * PAGINADO desde o início — a carga inicial já busca só a primeira página
 * (`PAGE_SIZE`), não o histórico inteiro do aluno. Isso beneficia tanto o
 * histórico completo (Ferramentas > Anotações) quanto o painel rápido da
 * execução do treino (QuickNotePanel.tsx), que só precisa das anotações
 * mais recentes pra resolver a de hoje — nunca precisou de tudo.
 */
export function useTrainingNotes(alunoId: string): UseTrainingNotes {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const notes = useAlunoStore((s) => s.getNotas(alunoId));
  const setNotas = useAlunoStore((s) => s.setNotas);
  const appendNotas = useAlunoStore((s) => s.appendNotas);
  const addNota = useAlunoStore((s) => s.addNota);
  const updateNota = useAlunoStore((s) => s.updateNota);
  const removeNota = useAlunoStore((s) => s.removeNota);

  const canWrite = useAuthStore((s) => s.role === 'personal');
  const showToast = useUIStore((s) => s.showToast);
  const ask = useConfirmStore((s) => s.ask);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  // Cursor de paginação: createdAt (ISO) da última anotação já carregada.
  // Não precisa ser estado — só é lido dentro de `carregarMais`, nunca
  // renderizado.
  const cursorRef = useRef<string | undefined>(undefined);

  const email = aluno?.email;

  useEffect(() => {
    if (!email || !canWrite) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    cursorRef.current = undefined;

    listNotesByAlunoPage(email, PAGE_SIZE)
      .then((primeiraPagina) => {
        if (cancelled) return;
        setNotas(alunoId, primeiraPagina);
        cursorRef.current = primeiraPagina.at(-1)?.createdAt;
        setHasMore(primeiraPagina.length === PAGE_SIZE);
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

  const carregarMais = useCallback(() => {
    if (!email || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);

    listNotesByAlunoPage(email, PAGE_SIZE, cursorRef.current)
      .then((pagina) => {
        appendNotas(alunoId, pagina);
        if (pagina.length > 0) cursorRef.current = pagina.at(-1)?.createdAt;
        setHasMore(pagina.length === PAGE_SIZE);
      })
      .catch((e) => {
        console.error('useTrainingNotes: falha ao carregar mais anotações', e);
        setError('Não foi possível carregar mais anotações.');
      })
      .finally(() => setLoadingMore(false));
  }, [email, loading, loadingMore, hasMore, alunoId, appendNotas]);

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
      if (!nota.authorId) {
        // Autor é um dos campos que o pedido exige vir sempre preenchido
        // automaticamente — nunca grava uma anotação sem saber quem a
        // criou (ex.: authUser momentaneamente nulo na criação automática
        // do painel rápido).
        console.error('useTrainingNotes: recusando criar anotação sem authorId');
        showToast('Não foi possível identificar o autor. Tente novamente.', 'error');
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
        // Sem toast aqui de propósito (ver doc da interface) — o
        // NoteEditor já cobre isso com o status "Não sincronizado" e tenta
        // de novo sozinho; o conteúdo já está seguro no cache otimista
        // acima, que é persistido em localStorage por useAlunoStore.
        console.error('useTrainingNotes: falha ao salvar anotação (será tentado de novo)', e);
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

  return {
    notes,
    loading,
    loadingMore,
    hasMore,
    error,
    retry,
    carregarMais,
    canWrite,
    criar,
    salvarConteudo,
    remover,
  };
}
