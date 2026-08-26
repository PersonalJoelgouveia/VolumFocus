import { useState } from 'react';
import { useAlunoStore } from '../store/useAlunoStore';
import { iniciais } from '../types/aluno';
import { AlunoFormModal } from '../components/clientes/AlunoFormModal';
import { AlunoDetailModal } from '../components/clientes/AlunoDetailModal';
import { RoutineEditorModal } from '../components/clientes/RoutineEditorModal';
import '../components/clientes/ClientesView.css';

/**
 * View "Clientes" — sucessora de view-clientes (cli_render/cli_cardHtml,
 * index.html ~10277-10287, ~10582-10599). Grid de alunos com busca por
 * nome; cada card abre o AlunoDetailModal, que por sua vez pode abrir o
 * RoutineEditorModal (cli-ed) num dia específico. Publicação (cli_persist +
 * salvarTreinoGoogleCloud) vive dentro do editor.
 */
export function ClientesView() {
  const alunos = useAlunoStore((s) => s.alunos);

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingAlunoId, setEditingAlunoId] = useState<string | null>(null);
  const [detailAlunoId, setDetailAlunoId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ alunoId: string; day: number } | null>(null);

  const filtered = alunos.filter((a) => a.nome.toLowerCase().includes(query.trim().toLowerCase()));
  const editingAluno = editingAlunoId ? alunos.find((a) => a.id === editingAlunoId) : undefined;

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Clientes <span className="tag">GESTÃO DE ALUNOS</span>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Novo Aluno
        </button>
      </div>

      <input
        className="cli-search"
        placeholder="Buscar aluno por nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="cli-empty">
          {alunos.length === 0
            ? 'Nenhum aluno cadastrado ainda. Toque em "+ Novo Aluno" para começar.'
            : `Nenhum aluno encontrado para "${query}".`}
        </div>
      ) : (
        <div className="cli-grid">
          {filtered.map((a) => (
            <div className="card cli-card" key={a.id} onClick={() => setDetailAlunoId(a.id)}>
              <div className="cli-card-top">
                <div className="cli-avatar">{iniciais(a.nome)}</div>
                <div className="cli-info">
                  <div className="cli-name" title={a.nome}>
                    {a.nome}
                  </div>
                  <div className="cli-meta-row">
                    <span className="tag">{a.foco}</span>
                  </div>
                  <div className="cli-last">Último treino: {a.ultimoTreino ?? '—'}</div>
                </div>
              </div>
              <div className="cli-actions-row" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm" onClick={() => setDetailAlunoId(a.id)}>
                  Ver Rotina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <AlunoFormModal aluno={undefined} onClose={() => setCreating(false)} />}
      {editingAluno && <AlunoFormModal aluno={editingAluno} onClose={() => setEditingAlunoId(null)} />}

      {detailAlunoId && (
        <AlunoDetailModal
          alunoId={detailAlunoId}
          onClose={() => setDetailAlunoId(null)}
          onEditPerfil={() => {
            setEditingAlunoId(detailAlunoId);
          }}
          onEditarRotina={(day) => {
            setEditorState({ alunoId: detailAlunoId, day });
            setDetailAlunoId(null);
          }}
        />
      )}

      {editorState && (
        <RoutineEditorModal
          alunoId={editorState.alunoId}
          initialDay={editorState.day}
          onClose={() => setEditorState(null)}
        />
      )}
    </div>
  );
}
