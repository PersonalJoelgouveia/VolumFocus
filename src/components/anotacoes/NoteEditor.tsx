import { useCallback, useEffect, useRef, useState } from 'react';
import { TRAINING_NOTE_MAX_LENGTH } from '../../types/trainingNote';
import './NoteEditor.css';

const AUTOSAVE_DEBOUNCE_MS = 1200;
/** Se `onSalvar` não responder dentro deste tempo, para de esperar e
 *  assume "não sincronizado" — evita deixar "Salvando…" preso pra sempre
 *  numa conexão que caiu no meio do envio (o Firestore, sem persistência
 *  offline configurada neste projeto, pode deixar a Promise pendente em
 *  vez de rejeitar na hora). O envio original continua rodando em segundo
 *  plano e ainda pode terminar em sucesso mais tarde (ver `minhaTentativa`
 *  abaixo). */
const TIMEOUT_SEM_RESPOSTA_MS = 6000;
/** Depois de marcar "não sincronizado", tenta de novo sozinho por tempo —
 *  complementado pelo listener de `online`, que tenta na hora assim que a
 *  conexão volta, sem esperar este timer. */
const RETRY_MS = 5000;

type SaveStatus = 'idle' | 'salvando' | 'salvo' | 'nao_sincronizado';

interface NoteEditorProps {
  noteId: string;
  /** Conteúdo inicial (da anotação já carregada) — o editor só lê isso na
   *  montagem; para trocar de anotação, remonte com uma `key` diferente
   *  (ex.: `key={nota.id}`) em vez de mudar esta prop em um componente já
   *  montado. */
  conteudoInicial: string;
  /** Persiste o conteúdo (ex.: useTrainingNotes.salvarConteudo). Deve
   *  devolver `true`/`false` — nunca lançar. Importante: já grava o
   *  conteúdo no cache local (otimista) ANTES de tentar a nuvem — ver doc
   *  do componente abaixo. */
  onSalvar: (noteId: string, conteudo: string) => Promise<boolean>;
  readOnly?: boolean;
  autoFocus?: boolean;
}

/**
 * Campo de texto grande e confortável pra observações do Personal —
 * textarea nativo simples e robusto (nada de editor rico) — com autosave.
 *
 * FLUXO DE AUTOSAVE (usuário digita → detecta alteração → debounce →
 * salva → "Salvando…" → sucesso → "Salvo"): cada tecla em `handleChange`
 * cancela e reagenda o debounce (`agendarAutosave`) — uma rajada de
 * digitação rápida cancela a anterior e só dispara UM envio ao Firestore,
 * depois que o usuário para de digitar. Nunca salva a cada tecla.
 *
 * DRAFT LOCAL — REAPROVEITADO, não recriado: `onSalvar` (useTrainingNotes.
 * salvarConteudo) escreve o conteúdo no cache local (useAlunoStore.notas)
 * de forma síncrona e incondicional, ANTES de tentar o Firestore — e esse
 * store inteiro já é persistido via zustand/persist em localStorage
 * (`jg3_alunos`). Por isso este componente SEMPRE chama `onSalvar`, nunca
 * pula essa chamada mesmo sabendo que está offline: pular a chamada
 * pularia também a gravação local. O texto digitado sobrevive a fechar a
 * aba, recarregar a página ou perder rede sem nenhum código novo de
 * persistência aqui — é exatamente a "persistência local existente"
 * pedida. "Reabrir imediatamente" também vem disso: quem monta este
 * editor lê `conteudoInicial` desse mesmo cache (ver AnotacoesToolView.tsx),
 * nunca esperando o Firestore responder.
 *
 * FALHA/QUEDA DE REDE → "Não sincronizado": se `onSalvar` devolve `false`,
 * ou não responde a tempo (`TIMEOUT_SEM_RESPOSTA_MS`), o status muda pra
 * avisar que a NUVEM ainda não tem a versão mais recente — o conteúdo já
 * está seguro no draft local (parágrafo acima). `minhaTentativa` evita que
 * uma tentativa antiga e lenta, ao finalmente responder depois do timeout,
 * sobrescreva o status de uma tentativa mais nova já em andamento. Duas
 * tentativas automáticas de ressincronizar sem ação do usuário: timer
 * (`RETRY_MS`) e evento `online` do navegador.
 *
 * MINIMIZAR/FECHAR: ao desmontar, uma edição pendente (debounce ainda não
 * disparado) é enviada imediatamente antes de sair — nunca perde a última
 * tecla, e o draft local já cobre o resto até a próxima sincronização.
 *
 * Único cuidado ativo de texto: NUNCA truncar (`slice`) o valor pra
 * respeitar o limite de tamanho — cortar no meio de um emoji (par
 * substituto UTF-16) corromperia o caractere. Uma mudança que
 * ultrapassaria o limite é simplesmente ignorada, o texto já digitado
 * continua intacto.
 */
export function NoteEditor({ noteId, conteudoInicial, onSalvar, readOnly, autoFocus }: NoteEditorProps) {
  const [conteudo, setConteudo] = useState(conteudoInicial);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conteudoRef = useRef(conteudo);
  conteudoRef.current = conteudo;
  const statusRef = useRef(status);
  statusRef.current = status;
  // Incrementado a cada nova tentativa de envio — permite descartar o
  // resultado de uma tentativa antiga que responde tarde, depois que uma
  // mais nova já tomou conta do status.
  const tentativaIdRef = useRef(0);

  const enviar = useCallback(
    async (valor: string) => {
      const minhaTentativa = ++tentativaIdRef.current;
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      setStatus('salvando');

      // Auto-referência (`enviar` chamando `enviar`) — padrão recursivo
      // normal aqui, não uma dependência circular entre dois hooks:
      // agenda uma nova tentativa mais tarde a partir de dentro da
      // própria função.
      function marcarNaoSincronizadoEAgendarRetry() {
        setStatus('nao_sincronizado');
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(() => void enviar(valor), RETRY_MS);
      }

      let respondeu = false;
      const timeoutId = setTimeout(() => {
        if (!respondeu && tentativaIdRef.current === minhaTentativa) {
          marcarNaoSincronizadoEAgendarRetry();
        }
      }, TIMEOUT_SEM_RESPOSTA_MS);

      const ok = await onSalvar(noteId, valor);
      respondeu = true;
      clearTimeout(timeoutId);
      if (tentativaIdRef.current !== minhaTentativa) return; // superada por uma tentativa mais nova

      if (ok) {
        setStatus('salvo');
      } else {
        marcarNaoSincronizadoEAgendarRetry();
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

  // Volta a ficar online enquanto havia algo não sincronizado → tenta de
  // novo na hora, sem esperar o timer de retry.
  useEffect(() => {
    function handleOnline() {
      if (statusRef.current === 'nao_sincronizado') {
        void enviar(conteudoRef.current);
      }
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [enviar]);

  // Ao desmontar (minimizar/fechar/sair da tela), garante que uma edição
  // recente pendente (debounce ainda não disparado) ainda seja enviada —
  // nunca perde a última tecla, e o draft local (ver doc do componente)
  // já cobre o resto até a próxima sincronização.
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
      <div className={`ne-status${status === 'nao_sincronizado' ? ' ne-status-alerta' : ''}`} aria-live="polite">
        {status === 'salvando' && 'Salvando…'}
        {status === 'salvo' && 'Salvo'}
        {status === 'nao_sincronizado' && 'Não sincronizado'}
        {status === 'idle' && '\u00A0'}
      </div>
    </div>
  );
}
