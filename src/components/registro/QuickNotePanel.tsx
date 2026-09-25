import { useState } from 'react';
import { ClipboardPen, X } from 'lucide-react';
import { useSessionStore } from '../../store/useSessionStore';
import { useWorkoutStore } from '../../store/useWorkoutStore';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { DAYS } from '../../types/workout';
import { criarTrainingNoteVazia, isMesmoDiaCalendario } from '../../types/trainingNote';
import { useTrainingNotes } from '../../hooks/useTrainingNotes';
import { NoteEditor } from '../anotacoes/NoteEditor';
import './QuickNotePanel.css';

/**
 * Ícone 📝 (prancheta+caneta, lucide `ClipboardPen`) ao lado do botão
 * "Rotinas" em RegistroView.tsx — só aparece durante uma sessão presencial
 * com um Cliente (useSessionStore.activeSessionId), já que Anotações é uma
 * ferramenta "por cliente" e o treino do próprio Personal não tem cliente
 * associado.
 *
 * Ao clicar: abre o painel compacto, identificando automaticamente
 * cliente/treino/data-horário (sem pedir nada digitado) e resolvendo (ou
 * criando) a anotação do dia. Clicar de novo apenas minimiza — o conteúdo
 * já está salvo (autosave do NoteEditor) e a mesma anotação reabre depois.
 *
 * "Não misturar duas sessões diferentes": a anotação do dia é resolvida
 * por (treinoId=dia da semana selecionado) + (mesmo dia calendário), não
 * só pelo aluno — trocar de dia sem ser hoje nunca reaproveita a anotação
 * de hoje por engano.
 */
export function QuickNoteButton() {
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessao = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : undefined;
  // Enquanto a sessão está em foco, o dia selecionado ao vivo mora em
  // useWorkoutStore (ver useSessionStore.alternarSessao) — o `selectedDay`
  // salvo dentro de `sessions[]` só é atualizado ao trocar de aba, então
  // fica desatualizado enquanto esta é a aba ativa.
  const selectedDay = useWorkoutStore((s) => s.selectedDay);

  const [aberto, setAberto] = useState(false);

  if (!isPersonalMode || !activeSessao) return null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost qn-icon-btn"
        aria-label="Anotação do treino"
        title="Anotação do treino"
        onClick={() => setAberto((v) => !v)}
      >
        <ClipboardPen size={18} />
      </button>
      {aberto && (
        <QuickNotePanel
          alunoId={activeSessao.alunoId}
          alunoNome={activeSessao.alunoNome}
          selectedDay={selectedDay}
          sessionId={activeSessao.id}
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
  selectedDay: number;
  sessionId: string;
  onFechar: () => void;
}) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const authUser = useAuthStore((s) => s.user);
  const { notes, loading, salvarConteudo, criar } = useTrainingNotes(alunoId);
  const [criando, setCriando] = useState(false);

  const treinoId = String(selectedDay);
  const treinoNome = aluno?.rotina[selectedDay]?.tipo ?? DAYS[selectedDay as 0 | 1 | 2 | 3 | 4 | 5 | 6];
  const agora = new Date().toISOString();

  const notaDeHoje = notes.find((n) => n.treinoId === treinoId && isMesmoDiaCalendario(n.createdAt, agora));

  async function handleCriar() {
    if (criando) return;
    setCriando(true);
    const nota = criarTrainingNoteVazia({
      alunoId,
      alunoNome,
      authorId: authUser?.email ?? '',
      authorName: authUser?.name,
      treinoId,
      treinoNome,
      sessionId,
    });
    await criar(nota);
    setCriando(false);
  }

  return (
    <div className="qn-panel card">
      <div className="qn-panel-header">
        <div className="qn-panel-title">
          📝 {alunoNome} <span className="qn-panel-treino">· {treinoNome}</span>
        </div>
        <button type="button" className="qn-close-btn" onClick={onFechar} aria-label="Minimizar">
          <X size={16} />
        </button>
      </div>

      {loading && <div className="qn-panel-loading">Carregando…</div>}

      {!loading && notaDeHoje && (
        // key força remontar ao trocar de anotação (dia diferente/outra
        // sessão) — nunca reaproveita estado interno de edição entre
        // anotações distintas.
        <NoteEditor key={notaDeHoje.id} note={notaDeHoje} onSalvar={salvarConteudo} compact autoFocus />
      )}

      {!loading && !notaDeHoje && (
        <button type="button" className="btn btn-primary qn-nova-btn" onClick={handleCriar} disabled={criando}>
          {criando ? 'Criando…' : '+ Iniciar anotação'}
        </button>
      )}
    </div>
  );
}
