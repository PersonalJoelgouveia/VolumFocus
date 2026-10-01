import { memo, useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
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
 * Fluxo em 3 telas, tudo dentro do próprio hub Ferramentas (nenhuma rota/
 * sidebar nova, mesmo padrão de navegação por estado local já usado em
 * ModelosToolView.tsx/TimerToolView.tsx):
 *
 *   Clientes (reaproveita grid/busca de views/ClientesView.tsx)
 *     → Histórico do Cliente (cronológico, mais recente primeiro; carregado
 *       em páginas — "Carregar mais" busca a próxima, nunca o histórico
 *       inteiro de uma vez, ver useTrainingNotes/listNotesByAlunoPage)
 *       → Anotação aberta (conteúdo completo, editável com autosave via
 *         NoteEditor, mesmo componente do painel rápido da execução do
 *         treino)
 *
 * Persistência via useTrainingNotes (ponte local/Firestore, mesmo padrão
 * de usePhysicalAssessments) — cache local em useAlunoStore.notas.
 *
 * SEGURANÇA: as anotações são dado privado do Personal (não um prontuário
 * que o Aluno acompanha, ao contrário de Avaliação Física). Este guard de
 * `isPersonalMode` — como o filtro do card em FerramentasView.tsx — é só
 * higiene de interface: reduz a superfície exposta e evita uma tela quebrada
 * se algo chegar aqui fora do fluxo normal. NÃO é a proteção de verdade.
 * Um cliente Firestore usado diretamente (fora deste app) ainda dependeria
 * inteiramente da regra publicada em `alunos/{email}/anotacoes/{noteId}`
 * (ver comentário em lib/trainingNotesRepository.ts) — que nunca concede
 * `allow` nenhum ao próprio aluno, diferente da regra de avaliações físicas.
 */
export function AnotacoesToolView({ onVoltar }: { onVoltar: () => void }) {
  const [screen, setScreen] = useState<Screen>({ tipo: 'clientes' });
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  if (!isPersonalMode) {
    return (
      <div className="an-empty">
        Esta ferramenta é exclusiva do Personal Trainer.{' '}
        <button className="btn btn-ghost btn-sm" onClick={onVoltar}>
          ← Voltar
        </button>
      </div>
    );
  }

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
          <button className="btn btn-ghost btn-sm an-voltar" onClick={onVoltar}>
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
  const { notes, loading, loadingMore, hasMore, error, retry, carregarMais, canWrite, criar } =
    useTrainingNotes(alunoId);
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
        Aluno não encontrado.{' '}
        <button className="btn btn-ghost btn-sm" onClick={onVoltar}>
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          <button className="btn btn-ghost btn-sm an-voltar" onClick={onVoltar}>
            ← Anotações
          </button>
          {aluno.nome}{' '}
          <span className="tag">
            {notes.length}
            {hasMore ? '+' : ''} ANOTAÇÕES
          </span>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleNovaAnotacao} disabled={criando}>
            {criando ? 'Criando…' : '+ Nova Anotação'}
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
            // onAbrirNota é passado direto (não embrulhado numa closure por
            // item) — é o que permite ao React.memo abaixo pular o
            // re-render de itens que não mudaram quando a lista ganha uma
            // nova página ("Carregar mais") ou uma anotação diferente é
            // atualizada.
            <NoteListItem key={nota.id} nota={nota} onAbrirNota={onAbrirNota} />
          ))}

          {/* Carregamento incremental — nunca busca o histórico inteiro de
             uma vez (ver useTrainingNotes/listNotesByAlunoPage). Só aparece
             quando a página mais recente veio cheia. */}
          {hasMore && (
            <button className="btn btn-ghost an-carregar-mais" onClick={carregarMais} disabled={loadingMore}>
              {loadingMore ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Item do histórico — data, horário, treino relacionado (quando existir)
 *  e resumo curto do conteúdo. Ordem cronológica já vem do hook (mais
 *  recente primeiro, `listNotesByAlunoPage` ordena por `createdAt desc`).
 *
 *  Memoizado: com muitas anotações carregadas, recalcular resumo/data de
 *  TODOS os itens toda vez que a lista ganha uma página nova ("Carregar
 *  mais") ou que uma única anotação é atualizada em outro lugar seria
 *  trabalho desperdiçado — `.map()` sempre gera um array novo, mas os
 *  objetos `nota` de itens que não mudaram mantêm a mesma referência
 *  (useAlunoStore só substitui o item afetado), e React.memo aproveita
 *  isso pra pular o re-render desses itens. Só funciona porque
 *  `onAbrirNota` chega aqui como a mesma referência estável pra todo
 *  mundo, nunca uma closure recriada por item (ver `.map()` acima). */
const NoteListItem = memo(function NoteListItem({
  nota,
  onAbrirNota,
}: {
  nota: TrainingNote;
  onAbrirNota: (noteId: string) => void;
}) {
  const { data, horario } = formatarDataHorario(nota.createdAt);
  return (
    <div className="card an-item" onClick={() => onAbrirNota(nota.id)}>
      <div className="an-item-top">
        <span className="an-item-date">
          {data} · {horario}
        </span>
        {nota.treinoNome && <span className="tag">{nota.treinoNome}</span>}
      </div>
      <div className="an-item-resumo">{resumoConteudo(nota.conteudo)}</div>
    </div>
  );
});

function NotaScreen({ alunoId, noteId, onVoltar }: { alunoId: string; noteId: string; onVoltar: () => void }) {
  const notes = useAlunoStore((s) => s.getNotas(alunoId));
  const { canWrite, salvarConteudo, remover } = useTrainingNotes(alunoId);
  const nota = notes.find((n) => n.id === noteId);

  if (!nota) {
    return (
      <div className="an-empty">
        Anotação não encontrada.{' '}
        <button className="btn btn-ghost btn-sm" onClick={onVoltar}>
          ← Voltar
        </button>
      </div>
    );
  }

  const { data, horario } = formatarDataHorario(nota.createdAt);

  async function handleRemover() {
    // Só navega de volta se o Personal realmente confirmou — cancelar o
    // diálogo de confirmação não pode levar embora da anotação como se
    // ela tivesse sido excluída.
    const confirmou = await remover(noteId);
    if (confirmou) onVoltar();
  }

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          <button className="btn btn-ghost btn-sm an-voltar" onClick={onVoltar}>
            ← Histórico
          </button>
        </div>
        {canWrite && (
          <button className="btn btn-ghost btn-sm" onClick={handleRemover}>
            🗑 Excluir
          </button>
        )}
      </div>

      <div className="card an-editor-card">
        <div className="an-editor-header">
          <div className="an-editor-title">📝 {nota.alunoNome}</div>
          <div className="an-editor-meta">
            {data} · {horario}
            {nota.treinoNome && ` · ${nota.treinoNome}`}
          </div>
        </div>

        {/* key={nota.id} força remontar ao abrir uma anotação diferente —
           nunca reaproveita estado interno de edição entre anotações
           distintas (ver NoteEditor.tsx). */}
        <NoteEditor
          key={nota.id}
          noteId={nota.id}
          conteudoInicial={nota.conteudo}
          onSalvar={salvarConteudo}
          readOnly={!canWrite}
          autoFocus
        />
      </div>
    </div>
  );
}
