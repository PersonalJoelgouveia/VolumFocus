import { useState } from 'react';
import { useModeloStore } from '../../store/useModeloStore';
import {
  TRAINING_MODEL_CATEGORIAS,
  TRAINING_MODEL_CATEGORIA_LABELS,
  contarExercicios,
  modeloEstaVazio,
} from '../../types/trainingModel';
import type { TrainingModelCategoria } from '../../types/trainingModel';
import { CopiarParaClienteModal } from '../../components/modelos/CopiarParaClienteModal';
import './ModelosToolView.css';

type Screen = { tipo: 'hub' } | { tipo: 'categoria'; categoria: TrainingModelCategoria } | { tipo: 'nivel'; modeloId: string };

/**
 * Ferramenta "Modelos" (Sidebar > Ferramentas > Modelos) — biblioteca de 21
 * modelos de treino (Iniciante/Intermediário/Avançado × 7 níveis, ver
 * types/trainingModel.ts) que serve de ponto de partida pra montar a
 * rotina de um Cliente. Independente de Rotinas Salvas (useRotinaStore) —
 * nenhuma das duas ferramentas lê ou escreve na outra, e Rotinas Salvas
 * continua funcionando exatamente como antes.
 *
 * Navegação: hub de categorias → grid de 7 níveis → detalhe do nível, com
 * "Copiar para Cliente" (CopiarParaClienteModal) nesse último — converte o
 * modelo numa rotina nova e independente do Cliente escolhido (ver
 * utils/buildAlunoRotinaFromTrainingModel.ts). Editor de conteúdo
 * (adicionar/editar exercícios de um nível por aqui) continua sendo uma
 * etapa futura — os 21 níveis já vêm com conteúdo pronto (data/
 * modelosIniciante.ts, modelosIntermediario.ts, modelosAvancado.ts).
 */
export function ModelosToolView({ onVoltar }: { onVoltar: () => void }) {
  const [screen, setScreen] = useState<Screen>({ tipo: 'hub' });

  if (screen.tipo === 'categoria') {
    return (
      <CategoriaScreen
        categoria={screen.categoria}
        onVoltar={() => setScreen({ tipo: 'hub' })}
        onAbrirNivel={(modeloId) => setScreen({ tipo: 'nivel', modeloId })}
      />
    );
  }

  if (screen.tipo === 'nivel') {
    return (
      <NivelDetailScreen
        modeloId={screen.modeloId}
        onVoltar={() => setScreen({ tipo: 'categoria', categoria: screen.modeloId.split('-')[0] as TrainingModelCategoria })}
      />
    );
  }

  return <HubScreen onVoltar={onVoltar} onAbrirCategoria={(categoria) => setScreen({ tipo: 'categoria', categoria })} />;
}

function HubScreen({ onVoltar, onAbrirCategoria }: { onVoltar: () => void; onAbrirCategoria: (c: TrainingModelCategoria) => void }) {
  const modelos = useModeloStore((s) => s.modelos);

  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-page-title">Modelos</h3>
      <p className="md-hub-desc">
        Trilhas progressivas de treino, organizadas por nível de experiência — prontas pra copiar pra rotina de um
        Cliente.
      </p>
      <div className="md-cat-grid">
        {TRAINING_MODEL_CATEGORIAS.map((categoria) => {
          const doCategoria = modelos.filter((m) => m.categoria === categoria);
          const preenchidos = doCategoria.filter((m) => !modeloEstaVazio(m)).length;
          return (
            <button key={categoria} type="button" className="md-cat-card" onClick={() => onAbrirCategoria(categoria)}>
              <div className="md-cat-title">{TRAINING_MODEL_CATEGORIA_LABELS[categoria]}</div>
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
  categoria: TrainingModelCategoria;
  onVoltar: () => void;
  onAbrirNivel: (modeloId: string) => void;
}) {
  const todosModelos = useModeloStore((s) => s.modelos);

const modelos = useMemo(
  () =>
    todosModelos
      .filter((m) => m.categoria === categoria)
      .sort((a, b) => a.nivel - b.nivel),
  [todosModelos, categoria]
);

  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
      <h3 className="md-page-title">{TRAINING_MODEL_CATEGORIA_LABELS[categoria]}</h3>
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
  const [copiarOpen, setCopiarOpen] = useState(false);

  if (!modelo) return null;
  const vazio = modeloEstaVazio(modelo);

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
          {TRAINING_MODEL_CATEGORIA_LABELS[modelo.categoria]} · Nível {modelo.nivel}
        </span>
        <h3 className="md-page-title" style={{ margin: '6px 0 0' }}>
          {modelo.nome}
        </h3>
      </div>

      {vazio ? (
        <div className="md-empty-state">
          <div className="md-empty-ico" aria-hidden="true">
            📋
          </div>
          <div className="md-empty-title">Nenhum treino cadastrado ainda</div>
          <div className="md-empty-desc">Este nível ainda não tem sessões — não há como copiar pra um Cliente.</div>
        </div>
      ) : (
        <div className="md-empty-state">
          <div className="md-empty-desc">
            {modelo.sessoes.length} sessão{modelo.sessoes.length > 1 ? 'ões' : ''} · {contarExercicios(modelo)}{' '}
            exercício(s) cadastrados neste nível.
          </div>
        </div>
      )}

      {copiarOpen && <CopiarParaClienteModal modelo={modelo} onClose={() => setCopiarOpen(false)} />}
    </div>
  );
}
