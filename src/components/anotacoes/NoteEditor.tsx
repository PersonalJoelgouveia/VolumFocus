import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrainingNote } from '../../types/trainingNote';
import { TRAINING_NOTE_MAX_LENGTH, formatarDataHorario } from '../../types/trainingNote';
import { deleteDraft, getDraft, saveDraft } from '../../lib/trainingNoteDraftStore';
import './NoteEditor.css';

const AUTOSAVE_DEBOUNCE_MS = 1200;
/** Reagenda uma nova tentativa automática depois de uma falha de rede —
 *  além da tentativa disparada pela próxima tecla, cobre o caso do
 *  Personal parar de digitar logo após um erro (pedido: "aguardar
 *  eventual gravação pendente"). */
const RETRY_AFTER_ERROR_MS = 5000;

type SaveStatus = 'idle' | 'salvando' | 'salvo' | 'erro';

interface NoteEditorProps {
  note: TrainingNote;
  /** Chamado com o novo conteúdo pra persistir (useTrainingNotes.salvarConteudo). */
  onSalvar: (noteId: string, conteudo: string) => Promise<boolean>;
  /** Compacto = painel rápido durante a execução do treino (menos altura, cabeçalho reduzido). */
  compact?: boolean;
  autoFocus?: boolean;
}

/**
 * Textarea simples e robusto (por pedido explícito — nada de editor rico)
 * com autosave: a cada tecla grava o draft local (IndexedDB, imediato) e
 * agenda o envio ao Firestore após um pequeno debounce. Ctrl/Cmd+Enter
 * força o envio na hora. Cursor nunca é mexido durante o autosave — só o
 * `value` do textarea (controlado) muda, nunca a seleção.
 */
export function NoteEditor({ note, onSalvar, compact, autoFocus }: NoteEditorProps) {
  const [conteudo, setConteudo] = useState(note.conteudo);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conteudoRef = useRef(conteudo);
  conteudoRef.current = conteudo;

  // Recuperação de draft local mais novo que o que veio do Firestore —
  // cobre o caso de a última tentativa de autosave ter falhado por rede.
  useEffect(() => {
    let cancelled = false;
    getDraft(note.id).then((draft) => {
      if (cancelled || !draft) return;
      if (new Date(draft.updatedAt).getTime() > new Date(note.updatedAt).getTime()) {
        setConteudo(draft.conteudo);
        void enviar(draft.conteudo);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const enviar = useCallback(
    async (valor: string) => {
      setStatus('salvando');
      const ok = await onSalvar(note.id, valor);
      if (ok) {
        setStatus('salvo');
        void deleteDraft(note.id);
      } else {
        setStatus('erro');
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => void enviar(conteudoRef.current), RETRY_AFTER_ERROR_MS);
      }
    },
    [note.id, onSalvar]
  );

  function handleChange(valor: string) {
    if (valor.length > TRAINING_NOTE_MAX_LENGTH) return; // reforça o maxLength do textarea
    setConteudo(valor);
    void saveDraft(note.id, valor);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
    debounceRef.current = setTimeout(() => void enviar(valor), AUTOSAVE_DEBOUNCE_MS);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void enviar(conteudoRef.current);
    }
  }

  // Ao desmontar (fechar/minimizar o painel), garante que uma edição
  // recente pendente ainda seja enviada — não perde a última tecla.
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        void enviar(conteudoRef.current);
      }
    },
    [enviar]
  );

  const { data, horario } = formatarDataHorario(note.createdAt);

  return (
    <div className={`ne-wrap${compact ? ' ne-compact' : ''}`}>
      {!compact && (
        <div className="ne-header">
          <div className="ne-header-title">📝 Anotação</div>
          <div className="ne-header-meta">
            {note.alunoNome} · {note.treinoNome ?? 'Treino'} · {data} {horario}
          </div>
        </div>
      )}
      <textarea
        className="ne-textarea"
        value={conteudo}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={TRAINING_NOTE_MAX_LENGTH}
        placeholder="Escreva suas observações sobre o treino…"
        autoFocus={autoFocus}
        rows={compact ? 6 : 14}
      />
      <div className="ne-status" aria-live="polite">
        {status === 'salvando' && 'Salvando…'}
        {status === 'salvo' && 'Salvo'}
        {status === 'erro' && 'Erro ao salvar — tentando de novo…'}
        {status === 'idle' && '\u00A0'}
      </div>
    </div>
  );
}
