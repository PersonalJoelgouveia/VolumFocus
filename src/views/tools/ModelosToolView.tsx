import { useState } from 'react';
import { useModeloStore } from '../../store/useModeloStore';
import {
  TRAINING_MODEL_CATEGORIAS,
  TRAINING_MODEL_CATEGORIA_LABELS,
  FREQUENCIAS_SEMANAIS,
  FREQUENCIA_LABELS,
  VARIANTES_POR_GENERO,
  VARIANTE_LABELS,
  contarExercicios,
  modeloEstaVazio,
} from '../../types/trainingModel';
import type { FrequenciaSemanal, TrainingModelCategoria, VariantePorGenero } from '../../types/trainingModel';
import { getEsqueletoFrequencia } from '../../data/frequenciaSemanal';
import { CopiarParaClienteModal } from '../../components/modelos/CopiarParaClienteModal';
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
 * data/frequenciaSemanal.ts) → grid de 7 níveis → detalhe do nível, com
 * "Copiar para Cliente" (CopiarParaClienteModal) nesse último.
 *
 * Etapa atual: só estrutura de navegação + dados (esqueleto de sessões
 * por frequência) — nenhum exercício foi recriado ainda pra essa
 * organização nova, `sessoes` fica vazio em todo o catálogo (ver nota em
 * data/trainingProgression.ts sobre o conteúdo anterior, incompatível
 * com este esquema). A tela de detalhe mostra o esqueleto planejado
 * (nome + foco de cada sessão) mesmo sem exercícios, pra deixar visível
 * o que vem a seguir.
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
  const [copiarOpen, setCopiarOpen] = useState(false);

  if (!modelo) return null;
  const vazio = modeloEstaVazio(modelo);
  const esqueleto = getEsqueletoFrequencia(modelo.frequencia, modelo.variante);

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

      <div className="md-esqueleto">
        <span className="md-metodos-label">Estrutura das sessões desta frequência</span>
        <div className="md-esqueleto-lista">
          {esqueleto.sessoes.map((s) => (
            <div className="md-esqueleto-item" key={s.nome}>
              <span className="md-nivel-badge">{s.nome}</span> {s.foco}
            </div>
          ))}
        </div>
        <div className="md-empty-desc" style={{ marginTop: 8 }}>
          ~45–60min de musculação por sessão, sem contar cardio. {esqueleto.cardioNota}
        </div>
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
