import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useAuthStore } from '../../store/useAuthStore';
import { iniciais } from '../../types/aluno';
import { criarTrainingNoteVazia, formatarDataHorario, resumoConteudo } from '../../types/trainingNote';
import type { TrainingNote } from '../../types/trainingNote';
import { useTrainingNotes } from '../../hooks/useTrainingNotes';
import { NoteEditor } from '../../components/anotacoes/NoteEditor';
import '../../components/clientes/ClientesView.css';
import './AnotacoesToolView.css';

type Screen = { tipo: 'clientes' } | { tipo: 'historico'; alunoId: string } | { tipo: 'nota'; alunoId: string; noteId: string };

/**
 * Ferramenta "Anotações" (Sidebar > Ferramentas > Anotações) — prontuário
 * de acompanhamento do treinamento por Cliente, NÃO um prontuário médico
 * (sem diagnóstico/prescrição/interpretação clínica, ver types/trainingNote.ts).
 *
 * Navegação em 3 telas: lista de Clientes (reaproveita o grid/busca de
 * views/ClientesView.tsx) → histórico do Cliente (cronológico, mais
 * recente primeiro) → anotação aberta (NoteEditor, compartilhado com o
 * painel rápido da execução do treino em components/registro/QuickNotePanel.tsx).
 *
 * Persistência via useTrainingNotes (ponte local/Firestore, mesmo padrão
 * de usePhysicalAssessments) — cache local em useAlunoStore.notas.
 */
export function AnotacoesToolView({ onVoltar }: { onVoltar: () => void }) {
  const [screen, setScreen] = useState<Screen>({ tipo: 'clientes' });

  if (screen.tipo === 'historico') {
    return (
      <HistoricoScreen
        alunoId={screen.alunoId}
        onVoltar={() => setScreen({ tipo: 'clientes' })}
        onAbrirNota={(noteId) => setScreen({ tipo: 'nota', alunoId: screen.alunoId, noteId })}
      />
    );
  }

  if (screen.tipo === 'nota') {
    return (
      <NotaScreen
        alunoId={screen.alunoId}
        noteId={screen.noteId}
        onVoltar={() => setScreen({ tipo: 'historico', alunoId: screen.alunoId })}
      />
    );
  }

  return <ClientesScreen onVoltar={onVoltar} onSelecionar={(alunoId) => setScreen({ tipo: 'historico', alunoId })} />;
}

function ClientesScreen({ onVoltar, onSelecionar }: { onVoltar: () => void; onSelecionar: (alunoId: string) => void }) {
  const alunos = useAlunoStore((s) => s.alunos);
  const [query, setQuery] = useState('');

  const filtered = alunos.filter((a) => a.nome.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          <button className="btn btn-ghost btn-sm" onClick={onVoltar} style={{ marginRight: 8 }}>
            ← Ferramentas
          </button>
          Anotações <span className="tag">POR CLIENTE</span>
        </div>
      </div>

      <input
        className="cli-search"
        placeholder="Buscar aluno por nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="cli-empty">
          {alunos.length === 0 ? 'Nenhum aluno cadastrado ainda.' : `Nenhum aluno encontrado para "${query}".`}
        </div>
      ) : (
        <div className="cli-grid">
          {filtered.map((a) => (
            <div className="card cli-card" key={a.id} onClick={() => onSelecionar(a.id)}>
              <div className="cli-card-top">
                <div className="cli-avatar">{iniciais(a.nome)}</div>
                <div className="cli-info">
                  <div className="cli-name" title={a.nome}>
                    {a.nome}
                  </div>
                  <div className="cli-meta-row">
                    <span className="tag">{a.foco}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoricoScreen({
  alunoId,
  onVoltar,
  onAbrirNota,
}: {
  alunoId: string;
  onVoltar: () => void;
  onAbrirNota: (noteId: string) => void;
}) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const authUser = useAuthStore((s) => s.user);
  const { notes, loading, error, retry, canWrite, criar } = useTrainingNotes(alunoId);
  const [criando, setCriando] = useState(false);

  async function handleNovaAnotacao() {
    if (!aluno || criando) return;
    setCriando(true);
    const nota = criarTrainingNoteVazia({
      alunoId: aluno.id,
      alunoNome: aluno.nome,
      authorId: authUser?.email ?? '',
      authorName: authUser?.name,
    });
    const ok = await criar(nota);
    setCriando(false);
    if (ok) onAbrirNota(nota.id);
  }

  if (!aluno) {
    return (
      <div className="an-empty">
        Aluno não encontrado. <button className="btn btn-ghost btn-sm" onClick={onVoltar}>← Voltar</button>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          <button className="btn btn-ghost btn-sm" onClick={onVoltar} style={{ marginRight: 8 }}>
            ← Anotações
          </button>
          {aluno.nome} <span className="tag">{notes.length} ANOTAÇÕES</span>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleNovaAnotacao} disabled={criando}>
            + Nova Anotação
          </button>
        )}
      </div>

      {loading && <div className="an-empty">Carregando histórico…</div>}

      {!loading && error && (
        <div className="an-empty">
          {error}{' '}
          <button className="btn btn-ghost btn-sm" onClick={retry}>
            Tentar de novo
          </button>
        </div>
      )}

      {!loading && !error && notes.length === 0 && (
        <div className="an-empty">Nenhuma anotação ainda para {aluno.nome.split(' ')[0]}.</div>
      )}

      {!loading && !error && notes.length > 0 && (
        <div className="an-list">
          {notes.map((nota) => (
            <NoteListItem key={nota.id} nota={nota} onAbrir={() => onAbrirNota(nota.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteListItem({ nota, onAbrir }: { nota: TrainingNote; onAbrir: () => void }) {
  const { data, horario } = formatarDataHorario(nota.createdAt);
  return (
    <div className="card an-item" onClick={onAbrir}>
      <div className="an-item-top">
        <span className="an-item-date">{data} · {horario}</span>
        {nota.treinoNome && <span className="tag">{nota.treinoNome}</span>}
      </div>
      <div className="an-item-resumo">{resumoConteudo(nota.conteudo)}</div>
    </div>
  );
}

function NotaScreen({ alunoId, noteId, onVoltar }: { alunoId: string; noteId: string; onVoltar: () => void }) {
  const notes = useAlunoStore((s) => s.getNotas(alunoId));
  const { salvarConteudo, remover } = useTrainingNotes(alunoId);
  const nota = notes.find((n) => n.id === noteId);

  if (!nota) {
    return (
      <div className="an-empty">
        Anotação não encontrada. <button className="btn btn-ghost btn-sm" onClick={onVoltar}>← Voltar</button>
      </div>
    );
  }

  async function handleRemover() {
    await remover(noteId);
    onVoltar();
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          <button className="btn btn-ghost btn-sm" onClick={onVoltar} style={{ marginRight: 8 }}>
            ← Histórico
          </button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleRemover}>
          🗑 Excluir
        </button>
      </div>
      <div className="card an-editor-card">
        <NoteEditor key={nota.id} note={nota} onSalvar={salvarConteudo} autoFocus />
      </div>
    </div>
  );
}
