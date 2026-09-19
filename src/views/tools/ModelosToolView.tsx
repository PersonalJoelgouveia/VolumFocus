import { useState } from 'react';
import { useModeloStore } from '../../store/useModeloStore';
import { DAYS_SHORT, GROUP_LABELS } from '../../types/workout';
import { isAlunoExercicioCardio } from '../../types/aluno';
import type { AlunoExercicio } from '../../types/aluno';
import {
  MODELO_CATEGORIAS,
  MODELO_CATEGORIA_LABELS,
  METODOS_SUGERIDOS,
  contarExercicios,
  modeloEstaVazio,
} from '../../types/modelo';
import type { ModeloCategoria } from '../../types/modelo';
import { buildGroupedRows } from '../../utils/dayLogGrouping';
import { useReorderDrag } from '../../hooks/useReorderDrag';
import { ExercicioFormModal } from '../../components/clientes/ExercicioFormModal';
import { CopiarParaClienteModal } from '../../components/modelos/CopiarParaClienteModal';
import '../../components/clientes/ClientesView.css';
import './ModelosToolView.css';

type Screen = { tipo: 'hub' } | { tipo: 'categoria'; categoria: ModeloCategoria } | { tipo: 'nivel'; modeloId: string };

/**
 * Ferramenta "Modelos" (Sidebar > Ferramentas > Modelos) — biblioteca de 21
 * modelos de treino (Iniciante/Intermediário/Avançado × 7 níveis, ver
 * types/modelo.ts) que o Personal usa como ponto de partida pra montar a
 * rotina de um Cliente. Independente de Rotinas Salvas (useRotinaStore) —
 * nenhuma das duas ferramentas lê ou escreve na outra.
 *
 * Fluxo: Modelo → editar dia a dia (reaproveitando ExercicioFormModal,
 * buildGroupedRows e useReorderDrag já usados em RoutineEditorModal) →
 * "Copiar para Cliente" (CopiarParaClienteModal) → nova rotina independente
 * na Aluno.rotina do Cliente escolhido, via useModeloStore.copiarParaCliente.
 * Editar a rotina do Cliente depois nunca volta a alterar o modelo.
 *
 * Etapa 1: arquitetura + editor completo, catálogo dos 21 níveis vazio
 * (rotina "Descanso Total" nos 7 dias) — o conteúdo de cada nível é
 * preenchido progressivamente depois, pelo Personal, nesta mesma tela.
 */
export function ModelosToolView({ onVoltar }: { onVoltar: () => void }) {
  const [screen, setScreen] = useState<Screen>({ tipo: 'hub' });

  if (screen.tipo === 'categoria') {
    return <CategoriaScreen categoria={screen.categoria} onVoltar={() => setScreen({ tipo: 'hub' })} onAbrirNivel={(modeloId) => setScreen({ tipo: 'nivel', modeloId })} />;
  }

  if (screen.tipo === 'nivel') {
    return <NivelEditorScreen modeloId={screen.modeloId} onVoltar={() => setScreen({ tipo: 'categoria', categoria: screen.modeloId.split('-')[0] as ModeloCategoria })} />;
  }

  return <HubScreen onVoltar={onVoltar} onAbrirCategoria={(categoria) => setScreen({ tipo: 'categoria', categoria })} />;
}

function HubScreen({ onVoltar, onAbrirCategoria }: { onVoltar: () => void; onAbrirCategoria: (c: ModeloCategoria) => void }) {
  const modelos = useModeloStore((s) => s.modelos);

  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <p className="md-hub-desc">
        Modelos são trilhas progressivas de treino, prontas pra copiar pra rotina de um Cliente. Editar um modelo
        aqui nunca altera as rotinas já publicadas.
      </p>
      <div className="md-cat-grid">
        {MODELO_CATEGORIAS.map((categoria) => {
          const doCategoria = modelos.filter((m) => m.categoria === categoria);
          const preenchidos = doCategoria.filter((m) => !modeloEstaVazio(m)).length;
          return (
            <button key={categoria} type="button" className="md-cat-card" onClick={() => onAbrirCategoria(categoria)}>
              <div className="md-cat-title">{MODELO_CATEGORIA_LABELS[categoria]}</div>
              <div className="md-cat-sub">
                {preenchidos}/{doCategoria.length} níveis com conteúdo
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoriaScreen({
  categoria,
  onVoltar,
  onAbrirNivel,
}: {
  categoria: ModeloCategoria;
  onVoltar: () => void;
  onAbrirNivel: (modeloId: string) => void;
}) {
  const listarPorCategoria = useModeloStore((s) => s.listarPorCategoria);
  const modelos = listarPorCategoria(categoria);

  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-cat-header">{MODELO_CATEGORIA_LABELS[categoria]}</h3>
      <div className="md-nivel-grid">
        {modelos.map((m) => {
          const total = contarExercicios(m);
          return (
            <button key={m.id} type="button" className="md-nivel-card" onClick={() => onAbrirNivel(m.id)}>
              <div className="md-nivel-num">Nível {m.nivel}</div>
              <div className="md-nivel-nome">{m.nome}</div>
              <div className={`md-nivel-status${total > 0 ? ' filled' : ''}`}>
                {total > 0 ? `${total} exercício${total > 1 ? 's' : ''}` : 'Vazio'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NivelEditorScreen({ modeloId, onVoltar }: { modeloId: string; onVoltar: () => void }) {
  const modelo = useModeloStore((s) => s.getModelo(modeloId));
  const atualizarInfo = useModeloStore((s) => s.atualizarInfo);
  const addExercicio = useModeloStore((s) => s.addExercicio);
  const updateExercicio = useModeloStore((s) => s.updateExercicio);
  const removeExercicio = useModeloStore((s) => s.removeExercicio);
  const reorderExercicios = useModeloStore((s) => s.reorderExercicios);
  const marcarDescanso = useModeloStore((s) => s.marcarDescanso);

  const [day, setDay] = useState(0);
  const [reorderMode, setReorderMode] = useState(false);
  const [exercicioIdx, setExercicioIdx] = useState<number | null | 'new'>(null);
  const [copiarOpen, setCopiarOpen] = useState(false);
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [nomeDraft, setNomeDraft] = useState(modelo?.nome ?? '');
  const [objetivoDraft, setObjetivoDraft] = useState(modelo?.objetivo ?? '');

  function handleReorder(fromIdx: number, toIdx: number) {
    reorderExercicios(modeloId, day, fromIdx, toIdx);
  }
  const { getItemProps, isDragging, isDragOver } = useReorderDrag(reorderMode, handleReorder);

  if (!modelo) return null;
  const dia = modelo.rotina[day];

  function handleSaveExercicio(ex: AlunoExercicio) {
    if (exercicioIdx === 'new') {
      addExercicio(modeloId, day, ex);
    } else if (typeof exercicioIdx === 'number') {
      updateExercicio(modeloId, day, exercicioIdx, ex);
    }
    setExercicioIdx(null);
  }

  function handleRemoveExercicio() {
    if (typeof exercicioIdx !== 'number') return;
    removeExercicio(modeloId, day, exercicioIdx);
    setExercicioIdx(null);
  }

  function handleSalvarInfo() {
    atualizarInfo(modeloId, { nome: nomeDraft.trim() || modelo!.nome, objetivo: objetivoDraft.trim() || undefined });
    setEditandoInfo(false);
  }

  function renderExItem(ex: AlunoExercicio, i: number) {
    return (
      <div
        className={`cli-ed-ex-item${isDragging(i) ? ' ro-dragging' : ''}${isDragOver(i) ? ' ro-drag-over' : ''}`}
        key={i}
        onClick={() => !reorderMode && setExercicioIdx(i)}
        {...getItemProps(i)}
      >
        {reorderMode && (
          <span className="cli-ed-ro-handle" title="Arrastar para reordenar">
            ↕
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cli-ex-name">{ex.nome}</div>
          <div className="cli-ex-detail">
            {isAlunoExercicioCardio(ex) ? (
              <>
                <span className="cli-ex-chip">{ex.duracao || '-'}</span>
                <span className="cli-ex-chip">{ex.intensidade || '-'}</span>
              </>
            ) : (
              <>
                <span className="cli-ex-chip">
                  {ex.series}×{ex.reps}
                </span>
                <span className="cli-ex-chip">{ex.carga}kg</span>
                {ex.rir != null && <span className="cli-ex-chip">RIR {ex.rir}</span>}
              </>
            )}
          </div>
        </div>
        {!reorderMode && <span className="cli-ed-ex-handle">✎</span>}
      </div>
    );
  }

  return (
    <div className="md-view">
      <div className="md-nivel-header-row">
        <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
          ← Voltar
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCopiarOpen(true)}>
          📤 Copiar para Cliente
        </button>
      </div>

      {editandoInfo ? (
        <div className="md-info-edit">
          <label className="cli-form-field full">
            <span>Nome do modelo</span>
            <input value={nomeDraft} onChange={(e) => setNomeDraft(e.target.value)} maxLength={60} />
          </label>
          <label className="cli-form-field full">
            <span>Objetivo (opcional)</span>
            <input value={objetivoDraft} onChange={(e) => setObjetivoDraft(e.target.value)} maxLength={140} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditandoInfo(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSalvarInfo}>
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <div className="md-info-view" onClick={() => setEditandoInfo(true)}>
          <h3 className="md-info-nome">
            {modelo.nome} <span className="md-info-edit-hint">✎</span>
          </h3>
          {modelo.objetivo && <p className="md-info-objetivo">{modelo.objetivo}</p>}
        </div>
      )}

      <div className="md-metodos-hint">
        <span className="md-metodos-label">Métodos sugeridos para {MODELO_CATEGORIA_LABELS[modelo.categoria].toLowerCase()}:</span>
        <div className="md-metodos-chips">
          {METODOS_SUGERIDOS[modelo.categoria].map((metodo) => (
            <span key={metodo} className="cli-ex-chip">
              {metodo}
            </span>
          ))}
        </div>
      </div>

      <div className="cli-days-bar">
        {DAYS_SHORT.map((label, d) => {
          const count = modelo.rotina[d].exercicios.length;
          return (
            <button
              key={label}
              className={`cli-day-btn${day === d ? ' active' : ''}`}
              onClick={() => {
                setReorderMode(false);
                setDay(d);
              }}
            >
              <div className="cli-dl">{label}</div>
              <div className="cli-ds">{count > 0 ? `${count}ex` : '-'}</div>
            </button>
          );
        })}
      </div>

      <div className="sec-row" style={{ marginBottom: 10 }}>
        <div className="cli-day-type" style={{ margin: 0 }}>
          {dia.tipo}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {dia.exercicios.length > 1 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setReorderMode((v) => !v)}>
              {reorderMode ? '✓ Concluir' : '↕️ Reordenar'}
            </button>
          )}
          {dia.exercicios.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => marcarDescanso(modeloId, day)}>
              💤 Marcar Descanso
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setExercicioIdx('new')}>
            + Exercício
          </button>
        </div>
      </div>

      <div className="cli-ed-day-content">
        {dia.exercicios.length === 0 ? (
          <div className="cli-rest-day">
            💤 Nenhum exercício neste dia ainda.
            <br />
            Toque em "+ Exercício" para começar a montar o nível.
          </div>
        ) : reorderMode ? (
          dia.exercicios.map((ex, i) => renderExItem(ex, i))
        ) : (
          buildGroupedRows(dia.exercicios).map((row) =>
            row.kind === 'free' ? (
              renderExItem(row.entry, row.index)
            ) : (
              <div className="cj-group" key={row.groupId}>
                <div className="cj-group-header">
                  <span className="cj-group-badge">{GROUP_LABELS[row.members[0].entry.groupType ?? 'biset']}</span>
                  <span className="cj-group-desc">{row.members.length} exercícios conjugados</span>
                </div>
                {row.members.map((m, k) => (
                  <div key={m.index}>
                    {k > 0 && <div className="cj-connector" />}
                    {renderExItem(m.entry, m.index)}
                  </div>
                ))}
              </div>
            )
          )
        )}
      </div>

      {exercicioIdx !== null && (
        <ExercicioFormModal
          existing={exercicioIdx === 'new' ? undefined : dia.exercicios[exercicioIdx]}
          onSave={handleSaveExercicio}
          onRemove={exercicioIdx !== 'new' ? handleRemoveExercicio : undefined}
          onClose={() => setExercicioIdx(null)}
        />
      )}

      {copiarOpen && <CopiarParaClienteModal modelo={modelo} onClose={() => setCopiarOpen(false)} />}
    </div>
  );
}
