import { useEffect, useRef, useState } from 'react';
import { ClipboardPen, X } from 'lucide-react';
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
 * Ícone 📝 (prancheta+caneta, lucide `ClipboardPen`) pra abrir a Anotação
 * da sessão atual — colocado ao lado do botão "Rotinas" em RegistroView.tsx
 * (ver import lá), sem nenhuma alteração no botão/lógica de Rotinas em si.
 *
 * Mesma classe `.btn.btn-ghost` do vizinho "Rotinas" (só ajustando o
 * padding pra ficar quadrado/ícone) — visual consistente por herdar o
 * mesmo estilo, não por replicar valores à mão. Faz parte do fluxo normal
 * (flex + gap) do cabeçalho de Treinos, então não desloca nem quebra o
 * layout existente.
 *
 * Clicar abre/minimiza um painel flutuante (nunca um modal — "minimizar"
 * implica algo que persiste em segundo plano, não algo que se fecha e
 * perde contexto). O conteúdo nunca depende do painel continuar montado:
 * ver NoteEditor.tsx (autosave com draft local reaproveitado do cache já
 * persistido do projeto) — fechar/minimizar só esconde a UI, o texto já
 * está seguro.
 */
export function QuickNoteButton({ alunoId, alunoNome, selectedDay, sessionId }: QuickNoteButtonProps) {
  const [aberto, setAberto] = useState(false);

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
        <QuickNotePanel
          alunoId={alunoId}
          alunoNome={alunoNome}
          selectedDay={selectedDay}
          sessionId={sessionId}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}

function QuickNotePanel({
  alunoId,
  alunoNome,
  selectedDay,
  sessionId,
  onFechar,
}: {
  alunoId: string;
  alunoNome: string;
  selectedDay: DayIndex;
  sessionId: string;
  onFechar: () => void;
}) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const authUser = useAuthStore((s) => s.user);
  const { notes, loading, criar, salvarConteudo } = useTrainingNotes(alunoId);
  // Garante que a criação automática (abaixo) só dispara uma vez por
  // abertura do painel, mesmo que o efeito rode de novo (StrictMode/re-render).
  const criacaoIniciadaRef = useRef(false);

  const treinoId = String(selectedDay);
  const treinoNome = aluno?.rotina[selectedDay]?.tipo ?? DAYS[selectedDay];

  // "Não misturar duas sessões diferentes": a anotação de hoje é resolvida
  // por (treinoId = dia da semana selecionado) + mesmo dia calendário —
  // nunca só pelo aluno. Reabre a mesma se já existir; nunca cria uma
  // segunda pro mesmo dia/treino.
  const notaDeHoje = notes.find((n) => n.treinoId === treinoId && isMesmoDiaCalendario(n.createdAt, new Date().toISOString()));

  // "O Personal deve começar a escrever imediatamente": assim que soubermos
  // que não existe anotação de hoje pra este treino, cria automaticamente
  // — sem exigir um clique extra de "Nova anotação" antes de poder digitar.
  useEffect(() => {
    if (loading || notaDeHoje || criacaoIniciadaRef.current || !aluno) return;
    criacaoIniciadaRef.current = true;
    void criar(
      criarTrainingNoteVazia({
        alunoId,
        alunoNome,
        authorId: authUser?.email ?? '',
        authorName: authUser?.name,
        treinoId,
        treinoNome,
        sessionId,
      })
    );
  }, [loading, notaDeHoje, aluno, alunoId, alunoNome, authUser, treinoId, treinoNome, sessionId, criar]);

  const cabecalho = notaDeHoje ? formatarDataHorario(notaDeHoje.createdAt) : null;

  return (
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
        <button type="button" className="qn-close-btn" onClick={onFechar} aria-label="Minimizar anotação">
          <X size={16} />
        </button>
      </div>

      {!notaDeHoje && <div className="qn-panel-loading">Carregando…</div>}

      {notaDeHoje && (
        // key={notaDeHoje.id} força remontar se por algum motivo a
        // anotação resolvida mudar (ex.: dia trocado) — nunca reaproveita
        // estado interno de edição entre anotações distintas.
        <NoteEditor
          key={notaDeHoje.id}
          noteId={notaDeHoje.id}
          conteudoInicial={notaDeHoje.conteudo}
          onSalvar={salvarConteudo}
          autoFocus
        />
      )}
    </div>
  );
}
