import { useState } from 'react';
import { useModeloStore } from '../../store/useModeloStore';
import {
  TRAINING_MODEL_CATEGORIAS,
  TRAINING_MODEL_CATEGORIA_LABELS,
  contarExercicios,
  modeloEstaVazio,
} from '../../types/trainingModel';
import type { TrainingModelCategoria } from '../../types/trainingModel';
import './ModelosToolView.css';

type Screen = { tipo: 'hub' } | { tipo: 'categoria'; categoria: TrainingModelCategoria } | { tipo: 'nivel'; modeloId: string };

/**
 * Ferramenta "Modelos" (Sidebar > Ferramentas > Modelos) — biblioteca de 21
 * modelos de treino (Iniciante/Intermediário/Avançado × 7 níveis, ver
 * types/modelo.ts) que vai servir de ponto de partida pra montar a rotina
 * de um Cliente. Independente de Rotinas Salvas (useRotinaStore) — nenhuma
 * das duas ferramentas lê ou escreve na outra, e Rotinas Salvas continua
 * funcionando exatamente como antes.
 *
 * ETAPA 1 (esta): só navegação (hub de categorias → grid de 7 níveis →
 * detalhe do nível), cards e estados vazios. Sem editor de exercícios e
 * sem "Copiar para Cliente" ainda — o conteúdo de cada nível e o fluxo de
 * cópia são etapas futuras, construídas por cima desta mesma estrutura de
 * 21 ids estáveis (`${categoria}-${nivel}`).
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
        Trilhas progressivas de treino, organizadas por nível de experiência — em breve, prontas pra copiar pra
        rotina de um Cliente.
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
  const listarPorCategoria = useModeloStore((s) => s.listarPorCategoria);
  const modelos = listarPorCategoria(categoria);

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

  if (!modelo) return null;
  const vazio = modeloEstaVazio(modelo);

  return (
    <div className="md-view">
      <button type="button" className="btn btn-ghost md-back" onClick={onVoltar}>
        ← Voltar
      </button>
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
          <div className="md-empty-desc">
            O conteúdo deste nível (exercícios por dia) e o botão "Copiar para Cliente" chegam numa próxima etapa.
          </div>
        </div>
      ) : (
        <div className="md-empty-state">
          <div className="md-empty-desc">{contarExercicios(modelo)} exercício(s) cadastrados neste nível.</div>
        </div>
      )}
    </div>
  );
}
