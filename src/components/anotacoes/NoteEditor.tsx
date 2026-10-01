import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { TRAINING_NOTE_MAX_LENGTH, terminaEmSurrogateSolto } from '../../types/trainingNote';
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
/** Faixa em que mostra "restam N caracteres" — só nos últimos 2000, pra
 *  não poluir a tela com um contador o tempo todo numa anotação curta. */
const AVISO_LIMITE_PROXIMO = 2000;

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
  /** Tamanho do campo de texto. 'padrao' (default) é o usado pela tela
   *  cheia de Anotações (Ferramentas), inalterado. 'compacto'/'expandido'
   *  existem pro painel rápido da execução do treino no celular — ocupa
   *  pouco espaço inicialmente (`compacto`) e permite expandir sob pedido
   *  (`expandido`), sem exigir que o Personal saia da tela de treino pra
   *  ter um campo grande pra escrever. */
  tamanho?: 'padrao' | 'compacto' | 'expandido';
}

/**
 * Campo de texto grande e confortável pra observações do Personal —
 * textarea nativo simples e robusto (nada de editor rico) — com autosave.
 * Pensado pra suportar um histórico extenso por cliente ao longo do tempo:
 * textos longos, qualquer caractere Unicode (acentos, cedilha, emojis,
 * símbolos), colagem de blocos grandes, múltiplas linhas/parágrafos.
 *
 * FLUXO DE AUTOSAVE (usuário digita → detecta alteração → debounce →
 * salva → "Salvando…" → sucesso → "Salvo"): cada tecla em `handleChange`
 * cancela e reagenda o debounce (`agendarAutosave`) — uma rajada de
 * digitação rápida cancela a anterior e só dispara UM envio ao Firestore,
 * depois que o usuário para de digitar. Nunca salva a cada tecla.
 *
 * CURSOR NUNCA PULA: o autosave (`enviar`) só lê `conteudoRef.current` e
 * muda o estado `status` — nunca chama `setConteudo`. O `value` do
 * textarea só muda como resultado direto do próprio evento de digitação do
 * usuário (`handleChange`), nunca como efeito colateral de salvar. Como o
 * React só precisa reconciliar `value` quando ELE muda, e quem muda é
 * sempre o mesmo evento que já move o cursor, o autosave rodando em
 * paralelo (via setTimeout) não tem como interferir na posição do cursor.
 *
 * RE-RENDER: `React.memo` (exportado abaixo) compara só `noteId`/`readOnly`/
 * `tamanho` — `conteudoInicial`/`onSalvar`/`autoFocus` só importam na
 * primeira montagem (documentado acima) e mudar de referência sem mudar de
 * nota não deve remontar nada. `tamanho` PRECISA estar na comparação —
 * diferente dos outros, ele deve mesmo re-renderizar quando o Personal
 * expande/recolhe o painel rápido. Sem isso, o próprio autosave bem-sucedido faria o
 * componente pai re-renderizar (o array de anotações no store ganha nova
 * referência a cada `updateNota`) e re-passar props "novas" que, embora
 * ignoradas depois da montagem, ainda disparariam um render supérfluo
 * deste componente a cada ciclo de autosave. Durante a digitação em si, só
 * este componente (não o pai, não a lista) re-renderiza a cada tecla — é
 * inerente a um campo controlado, e o custo é O(1) por tecla (o React só
 * atribui `.value` no nó do DOM, não percorre o conteúdo da string).
 *
 * DRAFT LOCAL — REAPROVEITADO, não recriado: `onSalvar` (useTrainingNotes.
 * salvarConteudo) escreve o conteúdo no cache local (useAlunoStore.notas)
 * de forma síncrona e incondicional, ANTES de tentar o Firestore — e esse
 * store inteiro já é persistido via zustand/persist em localStorage
 * (`jg3_alunos`). Por isso este componente SEMPRE chama `onSalvar`, nunca
 * pula essa chamada mesmo sabendo que está offline: pular a chamada
 * pularia também a gravação local. "Reabrir imediatamente" também vem
 * disso: quem monta este editor lê `conteudoInicial` desse mesmo cache
 * (ver AnotacoesToolView.tsx/QuickNotePanel.tsx), nunca esperando o
 * Firestore responder.
 *
 * ATUALIZAR A PÁGINA (F5): diferente de fechar/minimizar dentro do app (um
 * `useEffect` de cleanup normal dá conta), um recarregamento de página de
 * verdade NÃO roda cleanup de React — o listener de `beforeunload` abaixo
 * é o único jeito de garantir que uma edição ainda no debounce (< 1,2s)
 * não se perca: ele dispara a MESMA gravação local síncrona (primeira
 * linha de `salvarConteudo`, antes de qualquer `await`) bem a tempo de
 * entrar no localStorage antes da página realmente descarregar. A
 * tentativa de rede daquela mesma chamada pode não terminar a tempo — sem
 * problema, ela resincroniza sozinha (timer/evento `online`) na próxima
 * vez que a anotação for aberta.
 *
 * LIMITE DE TAMANHO: nunca trunca (`slice`) o texto já digitado pra caber
 * no limite — uma tecla que ultrapassaria é ignorada, o texto existente
 * fica intacto. A colagem de um bloco maior que o limite é diferente: o
 * PRÓPRIO NAVEGADOR corta no `maxLength` do textarea antes do React ver o
 * valor — e esse corte nativo conta unidades UTF-16, então pode cair bem
 * no meio de um emoji (par substituto), deixando uma metade solta.
 * `terminaEmSurrogateSolto` detecta exatamente esse caso e descarta essa
 * última unidade — nunca um caractere COMPLETO, só a metade inválida que o
 * corte do navegador deixou pra trás.
 */
function NoteEditorImpl({
  noteId,
  conteudoInicial,
  onSalvar,
  readOnly,
  autoFocus,
  tamanho = 'padrao',
}: NoteEditorProps) {
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
        // Pode existir um retry pendente se o timeout de 6s já tinha
        // marcado "não sincronizado" bem antes desta mesma chamada acabar
        // respondendo com sucesso (rede lenta, não necessariamente
        // offline) — sem isso, o retry dispararia sozinho mais tarde e
        // reenviaria o mesmo conteúdo já salvo, piscando o status de novo.
        if (retryRef.current) {
          clearTimeout(retryRef.current);
          retryRef.current = null;
        }
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

  function handleChange(valorBruto: string) {
    // Nunca corta texto já digitado — uma tecla que passaria do limite é
    // ignorada (o `maxLength` do textarea já bloqueia isso na digitação;
    // isto aqui é a segunda camada, ex.: valor chegando de outro lugar
    // maior que o limite).
    if (valorBruto.length > TRAINING_NOTE_MAX_LENGTH) return;

    // Colar um bloco maior que o limite: o navegador já cortou em
    // `maxLength` antes de chegar aqui, o que pode ter partido um emoji ao
    // meio. Só nesse caso específico (valor bateu exatamente no teto)
    // verifica e descarta a metade solta — nunca afeta uma anotação que
    // não chegou no limite.
    const valor =
      valorBruto.length === TRAINING_NOTE_MAX_LENGTH && terminaEmSurrogateSolto(valorBruto)
        ? valorBruto.slice(0, -1)
        : valorBruto;

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

  // Recarregar a página (F5) não roda cleanup de React — só este listener
  // garante que uma edição ainda dentro do debounce chegue no draft local
  // (localStorage) antes da página descarregar de verdade. Ver doc do
  // componente ("ATUALIZAR A PÁGINA").
  useEffect(() => {
    function handleBeforeUnload() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void onSalvar(noteId, conteudoRef.current);
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [noteId, onSalvar]);

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

  const noLimite = conteudo.length >= TRAINING_NOTE_MAX_LENGTH;
  const restantes = TRAINING_NOTE_MAX_LENGTH - conteudo.length;
  const avisoLimite = noLimite
    ? `Limite de ${TRAINING_NOTE_MAX_LENGTH.toLocaleString('pt-BR')} caracteres atingido — não é possível adicionar mais texto nesta anotação.`
    : restantes <= AVISO_LIMITE_PROXIMO
      ? `Restam ${restantes.toLocaleString('pt-BR')} caracteres.`
      : null;

  const rows = tamanho === 'compacto' ? 3 : tamanho === 'expandido' ? 10 : 16;

  return (
    <div className="ne-wrap">
      <textarea
        className={`ne-textarea${tamanho !== 'padrao' ? ` ne-textarea--${tamanho}` : ''}`}
        value={conteudo}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={TRAINING_NOTE_MAX_LENGTH}
        placeholder="Escreva suas observações sobre o treino…"
        autoFocus={autoFocus}
        readOnly={readOnly}
        rows={rows}
        spellCheck
        // Preserva quebra de linha visualmente igual ao que foi digitado
        // (sem colapsar espaços/linhas em branco).
        wrap="soft"
      />
      {avisoLimite && <div className={`ne-limite${noLimite ? ' ne-limite-atingido' : ''}`}>{avisoLimite}</div>}
      <div className={`ne-status${status === 'nao_sincronizado' ? ' ne-status-alerta' : ''}`} aria-live="polite">
        {status === 'salvando' && 'Salvando…'}
        {status === 'salvo' && 'Salvo'}
        {status === 'nao_sincronizado' && 'Não sincronizado'}
        {status === 'idle' && '\u00A0'}
      </div>
    </div>
  );
}

export const NoteEditor = memo(
  NoteEditorImpl,
  (prev, next) => prev.noteId === next.noteId && prev.readOnly === next.readOnly && prev.tamanho === next.tamanho
);
