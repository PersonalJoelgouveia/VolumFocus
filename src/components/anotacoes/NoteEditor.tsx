import { useCallback, useEffect, useRef, useState } from 'react';
import { TRAINING_NOTE_MAX_LENGTH } from '../../types/trainingNote';
import './NoteEditor.css';

const AUTOSAVE_DEBOUNCE_MS = 1200;
/** Depois de um erro, tenta de novo sozinho — cobre o caso do Personal
 *  parar de digitar logo após uma falha de rede, sem precisar apertar
 *  nada. */
const RETRY_AFTER_ERROR_MS = 5000;

type SaveStatus = 'idle' | 'salvando' | 'salvo' | 'erro';

interface NoteEditorProps {
  noteId: string;
  /** Conteúdo inicial (da anotação já carregada) — o editor só lê isso na
   *  montagem; para trocar de anotação, remonte com uma `key` diferente
   *  (ex.: `key={nota.id}`) em vez de mudar esta prop em um componente já
   *  montado. */
  conteudoInicial: string;
  /** Persiste o conteúdo (ex.: useTrainingNotes.salvarConteudo). Deve
   *  devolver `true`/`false` — nunca lançar. */
  onSalvar: (noteId: string, conteudo: string) => Promise<boolean>;
  readOnly?: boolean;
  autoFocus?: boolean;
}

/**
 * Campo de texto grande e confortável pra observações do Personal —
 * textarea nativo simples e robusto, de propósito (nada de editor rico:
 * negrito/listas/formatação ficam pra uma etapa futura, se pedido).
 *
 * Um `<textarea>` HTML já resolve, sozinho, praticamente todo o requisito
 * de texto desta etapa, sem nenhum código extra:
 * - Unicode completo (acentos, cedilha, emojis, símbolos) — string JS nativa,
 *   nunca reprocessada/normalizada aqui;
 * - quebras de linha preservadas exatamente como digitadas — é um campo
 *   controlado (`value`), sem nenhuma transformação no meio do caminho;
 * - colar texto (Ctrl/Cmd+V) já cola como texto puro dentro de um
 *   `<textarea>` — o navegador descarta formatação de rich text sozinho,
 *   sem precisar de um `onPaste` customizado;
 * - textos longos — sem limite de linhas, cresce e rola por conta própria.
 *
 * O único cuidado ativo é NUNCA truncar (`slice`) o valor pra respeitar o
 * limite de tamanho — cortar no meio de um emoji (par substituto UTF-16)
 * corromperia o caractere. Em vez disso, uma tecla que ultrapassaria o
 * limite é simplesmente ignorada (o texto já digitado continua intacto).
 */
export function NoteEditor({ noteId, conteudoInicial, onSalvar, readOnly, autoFocus }: NoteEditorProps) {
  const [conteudo, setConteudo] = useState(conteudoInicial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conteudoRef = useRef(conteudo);
  conteudoRef.current = conteudo;

  const enviar = useCallback(
    async (valor: string) => {
      setStatus('salvando');
      const ok = await onSalvar(noteId, valor);
      if (ok) {
        setStatus('salvo');
      } else {
        setStatus('erro');
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => void enviar(conteudoRef.current), RETRY_AFTER_ERROR_MS);
      }
    },
    [noteId, onSalvar]
  );

  function agendarAutosave(valor: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);
    debounceRef.current = setTimeout(() => void enviar(valor), AUTOSAVE_DEBOUNCE_MS);
  }

  function handleChange(valor: string) {
    // Nunca corta o texto — uma tecla que passaria do limite é ignorada
    // (o `maxLength` do textarea já bloqueia isso na digitação; isto aqui
    // é só a segunda camada de proteção, ex.: colar um texto enorme de
    // uma vez).
    if (valor.length > TRAINING_NOTE_MAX_LENGTH) return;
    setConteudo(valor);
    agendarAutosave(valor);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void enviar(conteudoRef.current);
    }
  }

  // Ao desmontar (sair da tela), garante que uma edição recente pendente
  // ainda seja enviada — nunca perde a última tecla por causa do debounce.
  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        void enviar(conteudoRef.current);
      }
      if (retryRef.current) clearTimeout(retryRef.current);
    },
    [enviar]
  );

  return (
    <div className="ne-wrap">
      <textarea
        className="ne-textarea"
        value={conteudo}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={TRAINING_NOTE_MAX_LENGTH}
        placeholder="Escreva suas observações sobre o treino…"
        autoFocus={autoFocus}
        readOnly={readOnly}
        rows={16}
        spellCheck
        // Preserva quebra de linha visualmente igual ao que foi digitado
        // (sem colapsar espaços/linhas em branco).
        wrap="soft"
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
