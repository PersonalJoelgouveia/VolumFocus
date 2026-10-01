import { useEffect, useRef, useState } from 'react';
import { ClipboardPen, Maximize2, Minimize2, X } from 'lucide-react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DAYS } from '../../types/workout';
import type { DayIndex } from '../../types/workout';
import { criarTrainingNoteVazia, formatarDataHorario, isMesmoDiaCalendario } from '../../types/trainingNote';
import { useTrainingNotes } from '../../hooks/useTrainingNotes';
import { NoteEditor } from '../anotacoes/NoteEditor';
import './QuickNotePanel.css';

interface QuickNoteButtonProps {
  alunoId: string;
  alunoNome: string;
  selectedDay: DayIndex;
  sessionId: string;
}

/**
 * Ícone 📝 (prancheta+caneta, lucide `ClipboardPen`) + painel flutuante de
 * Anotação da sessão atual — colocado ao lado do botão "Rotinas" em
 * RegistroView.tsx, sem nenhuma alteração no botão/lógica de Rotinas em si.
 *
 * IMPORTANTE: este componente permanece montado durante toda a sessão
 * presencial (RegistroView só desmonta ele quando a sessão muda/acaba —
 * ver `key={activeSessao.id}` no uso), mesmo quando o painel está
 * minimizado. `aberto` é só um booleano que decide o que é DESENHADO —
 * abrir/fechar o painel NUNCA desmonta este componente nem re-executa a
 * busca de anotações. Isso é o que garante:
 *
 * - "fechar o painel e continuar o treino → a mesma anotação continua
 *   acessível": `notaAtivaId` vive aqui, sobrevive a qualquer toggle de
 *   `aberto`;
 * - "evitar criar várias anotações acidentalmente": a resolução/criação
 *   automática (abaixo) roda no máximo uma vez por sessão+treino, travada
 *   por `criacaoIniciadaRef` — não por um efeito que dispara de novo a
 *   cada vez que o painel reabre.
 *
 * (Numa versão anterior o painel era desmontado ao minimizar, o que
 * recriava o hook de dados a cada reabertura; numa reabertura rápida,
 * antes do Firestore confirmar a criação anterior, isso podia fazer a
 * busca "não achar" a anotação recém-criada e criar uma segunda por
 * engano. Manter o estado aqui, num componente que não desmonta, elimina
 * essa janela de corrida por completo.)
 *
 * MOBILE DURANTE O TREINO: o painel abre COMPACTO (`NoteEditor
 * tamanho="compacto"`, ~3 linhas) de propósito — ocupa pouco espaço e
 * deixa a execução do treino (lista de exercícios, botão Rotinas) visível
 * ao redor, sem forçar o Personal a sair da tela pra anotar algo rápido.
 * O botão de expandir (`expandido`) troca pra um campo bem maior quando o
 * Personal realmente precisa escrever mais — nunca o contrário: o padrão
 * é sempre compacto, expandir é uma ação explícita. `max-height` +
 * `overflow-y: auto` no `.qn-panel` (CSS) garantem que, mesmo expandido e
 * com o teclado virtual aberto, o painel nunca cresce além da tela — rola
 * por dentro em vez de empurrar/cobrir tudo.
 */
export function QuickNoteButton({ alunoId, alunoNome, selectedDay, sessionId }: QuickNoteButtonProps) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const authUser = useAuthStore((s) => s.user);
  const { notes, loading, criar, salvarConteudo } = useTrainingNotes(alunoId);

  const [notaAtivaId, setNotaAtivaId] = useState<string | null>(null);
  // Trava a criação automática (abaixo) em no máximo uma vez por
  // sessão+treino — reaberturas do painel nunca disparam uma segunda.
  const criacaoIniciadaRef = useRef(false);
  const treinoIdAnteriorRef = useRef<string | null>(null);

  const treinoId = String(selectedDay);
  const treinoNome = aluno?.rotina[selectedDay]?.tipo ?? DAYS[selectedDay];

  // Se o treino selecionado mudou (o Personal trocou de dia durante a
  // sessão), a anotação ativa anterior não vale mais pro novo contexto —
  // cada treino tem a sua própria (nunca mistura duas sessões/dias
  // diferentes na mesma anotação).
  useEffect(() => {
    if (treinoIdAnteriorRef.current !== null && treinoIdAnteriorRef.current !== treinoId) {
      setNotaAtivaId(null);
      criacaoIniciadaRef.current = false;
    }
    treinoIdAnteriorRef.current = treinoId;
  }, [treinoId]);

  // "Não misturar duas sessões diferentes": a anotação de hoje pra este
  // treino é resolvida por (treinoId = dia da semana) + mesmo dia
  // calendário — nunca só pelo aluno.
  const notaDeHojeAuto = notes.find(
    (n) => n.treinoId === treinoId && isMesmoDiaCalendario(n.createdAt, new Date().toISOString())
  );

  // Resolve (achando a de hoje) ou cria (se não existir) a anotação ativa
  // — automaticamente, sem pedir nada ao Personal: alunoId, alunoNome,
  // treinoId, treinoNome, sessionId, data/hora e autor vêm todos do
  // contexto da sessão (ver criarTrainingNoteVazia). Roda de novo só se o
  // treino mudar (efeito acima reseta os guards).
  useEffect(() => {
    if (!aluno || loading || notaAtivaId || criacaoIniciadaRef.current) return;

    if (notaDeHojeAuto) {
      setNotaAtivaId(notaDeHojeAuto.id);
      return;
    }

    criacaoIniciadaRef.current = true;
    const nova = criarTrainingNoteVazia({
      alunoId,
      alunoNome,
      authorId: authUser?.email ?? '',
      authorName: authUser?.name,
      treinoId,
      treinoNome,
      sessionId,
    });
    setNotaAtivaId(nova.id); // otimista — não espera o Firestore pra já poder escrever
    void criar(nova);
  }, [aluno, loading, notaAtivaId, notaDeHojeAuto, alunoId, alunoNome, authUser, treinoId, treinoNome, sessionId, criar]);

  /** Ação explícita pedida: cria uma anotação NOVA (além da automática) e
   *  passa a mostrar essa — nunca disparada sozinha, só por clique direto. */
  function handleNovaAnotacao() {
    const nova = criarTrainingNoteVazia({
      alunoId,
      alunoNome,
      authorId: authUser?.email ?? '',
      authorName: authUser?.name,
      treinoId,
      treinoNome,
      sessionId,
    });
    criacaoIniciadaRef.current = true;
    setNotaAtivaId(nova.id);
    void criar(nova);
  }

  const notaAtiva = notes.find((n) => n.id === notaAtivaId);
  const cabecalho = notaAtiva ? formatarDataHorario(notaAtiva.createdAt) : null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost qn-icon-btn"
        title="Anotações"
        aria-label="Anotações"
        onClick={() => setAberto((v) => !v)}
      >
        <ClipboardPen size={18} />
      </button>

      {aberto && (
        <div className="qn-panel card">
          <div className="qn-panel-header">
            <div className="qn-panel-info">
              <div className="qn-panel-titulo">📝 Anotação</div>
              <div className="qn-panel-cliente">{alunoNome}</div>
              <div className="qn-panel-treino">{treinoNome}</div>
              {cabecalho && (
                <div className="qn-panel-datahora">
                  {cabecalho.data} · {cabecalho.horario}
                </div>
              )}
            </div>
            <div className="qn-panel-actions">
              <button
                type="button"
                className="qn-nova-btn"
                onClick={handleNovaAnotacao}
                title="Criar uma nova anotação além da atual"
              >
                + Nova
              </button>
              <button
                type="button"
                className="qn-expand-btn"
                onClick={() => setExpandido((v) => !v)}
                title={expandido ? 'Recolher campo de texto' : 'Expandir campo de texto'}
                aria-label={expandido ? 'Recolher campo de texto' : 'Expandir campo de texto'}
              >
                {expandido ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                className="qn-close-btn"
                onClick={() => setAberto(false)}
                title="Minimizar anotação"
                aria-label="Minimizar anotação"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {!notaAtiva && <div className="qn-panel-loading">Carregando…</div>}

          {notaAtiva && (
            // key={notaAtiva.id} força remontar o editor só quando a
            // anotação ativa realmente muda (troca de dia ou "+ Nova") —
            // nunca reaproveita estado interno de edição entre anotações
            // distintas. Trocar `tamanho` (compacto↔expandido) NÃO
            // remonta — é só re-render (ver comparador do React.memo em
            // NoteEditor.tsx), então o conteúdo/autosave em andamento
            // nunca é interrompido ao expandir/recolher.
            <NoteEditor
              key={notaAtiva.id}
              noteId={notaAtiva.id}
              conteudoInicial={notaAtiva.conteudo}
              onSalvar={salvarConteudo}
              tamanho={expandido ? 'expandido' : 'compacto'}
              autoFocus
            />
          )}
        </div>
      )}
    </>
  );
}
