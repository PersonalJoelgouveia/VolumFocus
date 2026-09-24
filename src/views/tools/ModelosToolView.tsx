import { useEffect, useState } from 'react';
import { useModeloStore } from '../../store/useModeloStore';
import {
  TRAINING_MODEL_CATEGORIAS,
  TRAINING_MODEL_CATEGORIA_LABELS,
  FREQUENCIAS_SEMANAIS,
  FREQUENCIA_LABELS,
  VARIANTES_POR_GENERO,
  VARIANTE_LABELS,
  TRAINING_MODEL_FASES,
  TRAINING_MODEL_FASE_LABELS,
  contarExercicios,
  modeloEstaVazio,
  isTrainingModelEntradaCardio,
} from '../../types/trainingModel';
import type { FrequenciaSemanal, TrainingModelCategoria, TrainingModelEntrada, TrainingModelFase, VariantePorGenero } from '../../types/trainingModel';
import { GROUP_LABELS } from '../../types/workout';
import { getEsqueletoFrequencia } from '../../data/frequenciaSemanal';
import { getMetaCardioSemanal, calcularCardioSemanalAtual, calcularCardioDaSessao } from '../../data/cardioSemanal';
import { useExerciseStore } from '../../store/useExerciseStore';
import { buildGroupedRows } from '../../utils/dayLogGrouping';
import { useReorderDrag } from '../../hooks/useReorderDrag';
import { CopiarParaClienteModal } from '../../components/modelos/CopiarParaClienteModal';
import { ModeloExercicioFormModal } from '../../components/modelos/ModeloExercicioFormModal';
import '../../components/clientes/ClientesView.css';
import './ModelosToolView.css';

type Screen =
  | { tipo: 'hub' }
  | { tipo: 'frequencia'; categoria: TrainingModelCategoria }
  | { tipo: 'variante'; categoria: TrainingModelCategoria; frequencia: FrequenciaSemanal }
  | { tipo: 'nivel-grid'; categoria: TrainingModelCategoria; frequencia: FrequenciaSemanal; variante?: VariantePorGenero }
  | {
      tipo: 'nivel-detalhe';
      modeloId: string;
      categoria: TrainingModelCategoria;
      frequencia: FrequenciaSemanal;
      variante?: VariantePorGenero;
    };

/**
 * Ferramenta "Modelos" (Sidebar > Ferramentas > Modelos) — biblioteca de
 * modelos de treino (ver types/trainingModel.ts) que serve de ponto de
 * partida pra montar a rotina de um Cliente. Independente de Rotinas
 * Salvas (useRotinaStore) — nenhuma das duas ferramentas lê ou escreve na
 * outra, e Rotinas Salvas continua funcionando exatamente como antes.
 *
 * Navegação em 3–4 telas: Nível de Treinamento (categoria) → Frequência
 * Semanal (2x/3x/4x/5x, com Versão Masculina/Feminina só na 4x, ver
 * data/frequenciaSemanal.ts) → grid de 7 níveis → detalhe do nível.
 *
 * O detalhe do nível é o editor completo do Modelo: ao abrir, materializa
 * as sessões a partir do esqueleto da frequência (garantirSessoesIniciais,
 * useModeloStore) se ainda não existirem, e mostra imediatamente a lista
 * de exercícios de cada bloco (Preparação/Mobilidade/Força/Cardio),
 * editável — adicionar, remover, substituir (ModeloExercicioFormModal,
 * mesma lógica de sugestão por taxonomia do Banco já usada na rotina do
 * Cliente), reordenar, editar séries/reps/descanso/método/cardio/duração.
 * Cada edição mexe SÓ nesta instância do modelo (useModeloStore, por
 * modeloId) — nunca em outro modelo, em Rotinas Salvas (useRotinaStore)
 * ou no Timer. "Copiar para Cliente" (CopiarParaClienteModal) sempre
 * copia a versão atualmente editada.
 */
export function ModelosToolView({ onVoltar }: { onVoltar: () => void }) {
  const [screen, setScreen] = useState<Screen>({ tipo: 'hub' });

  if (screen.tipo === 'frequencia') {
    return (
      <FrequenciaScreen
        categoria={screen.categoria}
        onVoltar={() => setScreen({ tipo: 'hub' })}
        onEscolher={(frequencia) =>
          setScreen(
            frequencia === 4
              ? { tipo: 'variante', categoria: screen.categoria, frequencia }
              : { tipo: 'nivel-grid', categoria: screen.categoria, frequencia }
          )
        }
      />
    );
  }

  if (screen.tipo === 'variante') {
    return (
      <VarianteScreen
        categoria={screen.categoria}
        frequencia={screen.frequencia}
        onVoltar={() => setScreen({ tipo: 'frequencia', categoria: screen.categoria })}
        onEscolher={(variante) =>
          setScreen({ tipo: 'nivel-grid', categoria: screen.categoria, frequencia: screen.frequencia, variante })
        }
      />
    );
  }

  if (screen.tipo === 'nivel-grid') {
    return (
      <NivelGridScreen
        categoria={screen.categoria}
        frequencia={screen.frequencia}
        variante={screen.variante}
        onVoltar={() =>
          setScreen(
            screen.frequencia === 4
              ? { tipo: 'variante', categoria: screen.categoria, frequencia: screen.frequencia }
              : { tipo: 'frequencia', categoria: screen.categoria }
          )
        }
        onAbrirNivel={(modeloId) =>
          setScreen({ tipo: 'nivel-detalhe', modeloId, categoria: screen.categoria, frequencia: screen.frequencia, variante: screen.variante })
        }
      />
    );
  }

  if (screen.tipo === 'nivel-detalhe') {
    return (
      <NivelDetailScreen
        modeloId={screen.modeloId}
        onVoltar={() =>
          setScreen({ tipo: 'nivel-grid', categoria: screen.categoria, frequencia: screen.frequencia, variante: screen.variante })
        }
      />
    );
  }

  return <HubScreen onVoltar={onVoltar} onAbrirCategoria={(categoria) => setScreen({ tipo: 'frequencia', categoria })} />;
}

function HubScreen({ onVoltar, onAbrirCategoria }: { onVoltar: () => void; onAbrirCategoria: (c: TrainingModelCategoria) => void }) {
  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-page-title">Modelos</h3>
      <p className="md-hub-desc">
        Escolha o Nível de Treinamento, depois a Frequência Semanal — cada combinação tem 7 níveis progressivos.
      </p>
      <div className="md-cat-grid">
        {TRAINING_MODEL_CATEGORIAS.map((categoria) => (
          <button key={categoria} type="button" className="md-cat-card" onClick={() => onAbrirCategoria(categoria)}>
            <div className="md-cat-title">{TRAINING_MODEL_CATEGORIA_LABELS[categoria]}</div>
            <div className="md-cat-sub">2x · 3x · 4x · 5x por semana</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FrequenciaScreen({
  categoria,
  onVoltar,
  onEscolher,
}: {
  categoria: TrainingModelCategoria;
  onVoltar: () => void;
  onEscolher: (frequencia: FrequenciaSemanal) => void;
}) {
  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-page-title">{TRAINING_MODEL_CATEGORIA_LABELS[categoria]}</h3>
      <p className="md-hub-desc">Frequência semanal de treino.</p>
      <div className="md-cat-grid">
        {FREQUENCIAS_SEMANAIS.map((frequencia) => {
          const esqueleto = frequencia === 4 ? undefined : getEsqueletoFrequencia(frequencia);
          return (
            <button key={frequencia} type="button" className="md-cat-card" onClick={() => onEscolher(frequencia)}>
              <div className="md-cat-title">{FREQUENCIA_LABELS[frequencia]}</div>
              <div className="md-cat-sub">
                {frequencia === 4 ? 'Versão Masculina ou Feminina' : `${esqueleto!.sessoes.length} sessões · 45–60min cada`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VarianteScreen({
  categoria,
  frequencia,
  onVoltar,
  onEscolher,
}: {
  categoria: TrainingModelCategoria;
  frequencia: FrequenciaSemanal;
  onVoltar: () => void;
  onEscolher: (variante: VariantePorGenero) => void;
}) {
  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-page-title">
        {TRAINING_MODEL_CATEGORIA_LABELS[categoria]} · {FREQUENCIA_LABELS[frequencia]}
      </h3>
      <p className="md-hub-desc">A divisão das sessões muda por versão nesta frequência.</p>
      <div className="md-cat-grid">
        {VARIANTES_POR_GENERO.map((variante) => {
          const esqueleto = getEsqueletoFrequencia(frequencia, variante);
          return (
            <button key={variante} type="button" className="md-cat-card" onClick={() => onEscolher(variante)}>
              <div className="md-cat-title">{VARIANTE_LABELS[variante]}</div>
              <div className="md-cat-sub">{esqueleto.sessoes.map((s) => s.nome).join('/')} — {esqueleto.sessoes[0].foco}…</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NivelGridScreen({
  categoria,
  frequencia,
  variante,
  onVoltar,
  onAbrirNivel,
}: {
  categoria: TrainingModelCategoria;
  frequencia: FrequenciaSemanal;
  variante?: VariantePorGenero;
  onVoltar: () => void;
  onAbrirNivel: (modeloId: string) => void;
}) {
  const listarPorFrequencia = useModeloStore((s) => s.listarPorFrequencia);
  const modelos = listarPorFrequencia(categoria, frequencia, variante);

  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-page-title">
        {TRAINING_MODEL_CATEGORIA_LABELS[categoria]} · {FREQUENCIA_LABELS[frequencia]}
        {variante ? ` · ${VARIANTE_LABELS[variante]}` : ''}
      </h3>
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

function NivelDetailScreen({ modeloId, onVoltar }: { modeloId: string; onVoltar: () => void }) {
  const modelo = useModeloStore((s) => s.getModelo(modeloId));
  const garantirSessoesIniciais = useModeloStore((s) => s.garantirSessoesIniciais);
  const addExercicio = useModeloStore((s) => s.addExercicio);
  const updateExercicio = useModeloStore((s) => s.updateExercicio);
  const removeExercicio = useModeloStore((s) => s.removeExercicio);
  const reorderExercicio = useModeloStore((s) => s.reorderExercicio);
  const setBlocoDuracao = useModeloStore((s) => s.setBlocoDuracao);
  const setDuracaoEstimada = useModeloStore((s) => s.setDuracaoEstimada);
  const exercises = useExerciseStore((s) => s.exercises);

  const [sessaoIdx, setSessaoIdx] = useState(0);
  const [faseAtiva, setFaseAtiva] = useState<TrainingModelFase>('forca');
  const [reorderMode, setReorderMode] = useState(false);
  const [editando, setEditando] = useState<TrainingModelEntrada | 'novo' | null>(null);
  const [copiarOpen, setCopiarOpen] = useState(false);

  useEffect(() => {
    if (modelo && modelo.sessoes.length === 0) garantirSessoesIniciais(modelo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeloId]);

  const { getItemProps, isDragging, isDragOver } = useReorderDrag(reorderMode, handleReorder);


  if (!modelo) return null;
  if (modelo.sessoes.length === 0) return null; // aguarda o efeito acima materializar as sessões

  const sessao = modelo.sessoes[Math.min(sessaoIdx, modelo.sessoes.length - 1)];
  const bloco = sessao.blocos.find((b) => b.fase === faseAtiva)!;
  const vazio = modeloEstaVazio(modelo);

  function nomeExercicio(exId: string): string {
    return exercises.find((e) => e.id === exId)?.name ?? `Exercício não encontrado (${exId})`;
  }

  function handleReorder(fromIdx: number, toIdx: number) {
    reorderExercicio(modelo!.id, sessao.id, faseAtiva, fromIdx, toIdx);
  }

  function handleSave(entrada: TrainingModelEntrada) {
    if (editando === 'novo') addExercicio(modelo!.id, sessao.id, faseAtiva, entrada);
    else updateExercicio(modelo!.id, sessao.id, faseAtiva, entrada);
    setEditando(null);
  }

  function handleRemove() {
    if (editando && editando !== 'novo') removeExercicio(modelo!.id, sessao.id, faseAtiva, editando.id);
    setEditando(null);
  }

  function renderEntrada(entrada: TrainingModelEntrada, idx: number) {
    const cardio = isTrainingModelEntradaCardio(entrada);
    return (
      <div
        className={`cli-ed-ex-item${isDragging(idx) ? ' ro-dragging' : ''}${isDragOver(idx) ? ' ro-drag-over' : ''}`}
        key={entrada.id}
        onClick={() => !reorderMode && setEditando(entrada)}
        {...getItemProps(idx)}
      >
        {reorderMode && (
          <span className="cli-ed-ro-handle" title="Arrastar para reordenar">
            ↕
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cli-ex-name">{nomeExercicio(entrada.exId)}</div>
          <div className="cli-ex-detail">
            {cardio ? (
              <>
                <span className="cli-ex-chip">{entrada.duracaoMinutos}min</span>
                <span className="cli-ex-chip">{entrada.intensidade}</span>
              </>
            ) : (
              <>
                <span className="cli-ex-chip">
                  {entrada.series}×{entrada.repsMin === entrada.repsMax ? entrada.repsMin : `${entrada.repsMin}-${entrada.repsMax}`}
                </span>
                {entrada.rir != null && <span className="cli-ex-chip">RIR {entrada.rir}</span>}
              </>
            )}
            {entrada.descansoSegundos != null && <span className="cli-ex-chip">{entrada.descansoSegundos}s desc.</span>}
            {entrada.metodo && entrada.metodo !== 'series_tradicionais' && <span className="cli-ex-chip">{entrada.metodo}</span>}
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
        <button type="button" className="btn btn-primary btn-sm" disabled={vazio} onClick={() => setCopiarOpen(true)}>
          📤 Copiar para Cliente
        </button>
      </div>

      <div className="md-nivel-header">
        <span className="md-nivel-badge">
          {TRAINING_MODEL_CATEGORIA_LABELS[modelo.categoria]} · {FREQUENCIA_LABELS[modelo.frequencia]}
          {modelo.variante ? ` · ${VARIANTE_LABELS[modelo.variante]}` : ''} · Nível {modelo.nivel}
        </span>
        <h3 className="md-page-title" style={{ margin: '6px 0 0' }}>
          {modelo.nome}
        </h3>
      </div>

      <div className="md-cardio-resumo">
        Cardio semanal: <strong>{calcularCardioSemanalAtual(modelo)} min</strong>
        <span className="md-cardio-meta"> (meta do nível: {getMetaCardioSemanal(modelo.categoria, modelo.nivel)} min)</span>
      </div>

      <label className="cli-form-field" style={{ maxWidth: 220, marginBottom: 14 }}>
        <span>Duração estimada da sessão (min)</span>
        <input
          type="number"
          min={0}
          value={modelo.duracaoEstimadaMinutos || ''}
          onChange={(e) => setDuracaoEstimada(modelo.id, Number(e.target.value) || 0)}
        />
      </label>

      <div className="cli-days-bar">
        {modelo.sessoes.map((s, i) => (
          <button
            key={s.id}
            className={`cli-day-btn${sessaoIdx === i ? ' active' : ''}`}
            onClick={() => {
              setReorderMode(false);
              setSessaoIdx(i);
            }}
          >
            <div className="cli-dl">{s.nome.split(' — ')[0]}</div>
            <div className="cli-ds">
              {s.blocos.reduce((acc, b) => acc + b.exercicios.length, 0)}ex · {calcularCardioDaSessao(s)}min cardio
            </div>
          </button>
        ))}
      </div>

      <div className="md-fase-tabs">
        {TRAINING_MODEL_FASES.map((fase) => {
          const b = sessao.blocos.find((bl) => bl.fase === fase)!;
          return (
            <button
              key={fase}
              type="button"
              className={`md-fase-tab${faseAtiva === fase ? ' active' : ''}`}
              onClick={() => {
                setReorderMode(false);
                setFaseAtiva(fase);
              }}
            >
              {TRAINING_MODEL_FASE_LABELS[fase]} {b.exercicios.length > 0 && `(${b.exercicios.length})`}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 10, marginTop: 12 }}>
        <label className="cli-form-field" style={{ margin: 0 }}>
          <span>Duração de referência deste bloco (min, opcional)</span>
          <input
            type="number"
            min={0}
            value={bloco.duracaoEstimadaMinutos ?? ''}
            onChange={(e) => setBlocoDuracao(modelo.id, sessao.id, faseAtiva, e.target.value ? Number(e.target.value) : undefined)}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {bloco.exercicios.length > 1 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setReorderMode((v) => !v)}>
              {reorderMode ? '✓ Concluir' : '↕️ Reordenar'}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setEditando('novo')}>
            + Exercício
          </button>
        </div>
      </div>

      <div className="cli-ed-day-content">
        {bloco.exercicios.length === 0 ? (
          <div className="cli-rest-day">Nenhum exercício neste bloco ainda.</div>
        ) : reorderMode ? (
          bloco.exercicios.map((ex, i) => renderEntrada(ex, i))
        ) : (
          buildGroupedRows(bloco.exercicios).map((row) =>
            row.kind === 'free' ? (
              renderEntrada(row.entry, row.index)
            ) : (
              <div className="cj-group" key={row.groupId}>
                <div className="cj-group-header">
                  <span className="cj-group-badge">{GROUP_LABELS[row.members[0].entry.groupType ?? 'biset']}</span>
                  <span className="cj-group-desc">{row.members.length} exercícios conjugados</span>
                </div>
                {row.members.map((m, k) => (
                  <div key={m.index}>
                    {k > 0 && <div className="cj-connector" />}
                    {renderEntrada(m.entry, m.index)}
                  </div>
                ))}
              </div>
            )
          )
        )}
      </div>

      {editando !== null && (
        <ModeloExercicioFormModal
          existing={editando === 'novo' ? undefined : editando}
          onSave={handleSave}
          onRemove={editando !== 'novo' ? handleRemove : undefined}
          onClose={() => setEditando(null)}
        />
      )}

      {copiarOpen && <CopiarParaClienteModal modelo={modelo} onClose={() => setCopiarOpen(false)} />}
    </div>
  );
}
