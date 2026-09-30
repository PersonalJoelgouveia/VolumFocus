import { useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { TimerToolView } from './tools/TimerToolView';
import { ModelosToolView } from './tools/ModelosToolView';
import { AnotacoesToolView } from './tools/AnotacoesToolView';
import './FerramentasView.css';

interface ToolCard {
  key: string;
  icon: string;
  title: string;
  desc: string;
  comingSoon?: boolean;
  /** Nunca mostrado pro Aluno — usado por ferramentas que são dado privado
   *  do Personal (ver Anotações). Isto é só higiene de interface: a
   *  proteção real é a regra do Firestore (Aluno não tem `allow` nenhum na
   *  subcoleção `anotacoes`), não esconder o card. */
  ptOnly?: boolean;
}

const CARDS: ToolCard[] = [
  { key: 'timer', icon: '⏱', title: 'Timer', desc: 'Timer de intervalos: preparação, exercício e descanso.' },
  { key: 'agenda', icon: '📅', title: 'Agenda', desc: 'Organize seus compromissos e sessões.', comingSoon: true },
  {
    key: 'anotacoes',
    icon: '📝',
    title: 'Anotações',
    desc: 'Prontuário de acompanhamento do treinamento por cliente.',
    ptOnly: true,
  },
  { key: 'modelos', icon: '📋', title: 'Modelos', desc: 'Biblioteca de modelos de treino organizados por nível de experiência.' },
  { key: 'lembretes', icon: '🔔', title: 'Lembretes', desc: 'Alertas pra você e seus alunos.', comingSoon: true },
];

type FerramentasScreen = 'hub' | 'timer' | 'modelos' | 'anotacoes';

/**
 * Hub "Ferramentas" — novo item de TOOLS_NAV (types/view.ts), mesmo padrão
 * de tela central única usado no restante do app (sem modal). O grid de
 * cards reaproveita o layout do VisaoGeralTab do hub Saúde (ver
 * views/saude/VisaoGeralTab.tsx + SaudeView.css .sh-overview-*), numa
 * página própria em vez de aba — daí a classe própria .ft-* em
 * FerramentasView.css em vez de reusar .sh-*.
 *
 * Timer abre `TimerToolView` (views/tools/TimerToolView.tsx), um timer de
 * intervalos genérico e isolado — sem relação com o cronômetro global de
 * treino (useTimerStore/<TimerEngine>) nem com dados de exercício/
 * musculação. Modelos abre `ModelosToolView` (views/tools/ModelosToolView.tsx)
 * — ferramenta independente de Rotinas Salvas (useRotinaStore), não a
 * substitui. Anotações abre `AnotacoesToolView` (views/tools/AnotacoesToolView.tsx)
 * — prontuário de acompanhamento do treinamento por Cliente (ver
 * types/trainingNote.ts): lista de Clientes → histórico do cliente
 * (data/horário/treino/resumo, mais recente primeiro) → conteúdo completo.
 * Ícone de criação durante a execução do treino (RegistroView) e autosave
 * em tempo real são etapas futuras — aqui a gravação é explícita. Os
 * demais cards continuam só visuais ("Em breve"), sem onClick nem estado.
 *
 * Anotações é `ptOnly` — nunca aparece nem abre em modo Aluno (ver
 * `CARDS.filter` abaixo + guard em `screen === 'anotacoes'`). Isto é
 * higiene de interface, não a proteção de verdade: quem impede o Aluno de
 * ler anotações de outro cliente (ou de qualquer cliente) é a regra do
 * Firestore documentada em lib/trainingNotesRepository.ts.
 */
export function FerramentasView() {
  const [screen, setScreen] = useState<FerramentasScreen>('hub');
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  if (screen === 'timer') {
    return <TimerToolView onVoltar={() => setScreen('hub')} />;
  }

  if (screen === 'modelos') {
    return <ModelosToolView onVoltar={() => setScreen('hub')} />;
  }

  // Segunda camada, não a única: mesmo que `screen` chegasse a 'anotacoes'
  // por algum caminho que não seja o clique no card abaixo (já filtrado
  // pro Aluno), a tela em si também se recusa a abrir fora do modo
  // Personal — ver mesmo guard em AnotacoesToolView.tsx.
  if (screen === 'anotacoes' && isPersonalMode) {
    return <AnotacoesToolView onVoltar={() => setScreen('hub')} />;
  }

  return (
    <div className="ft-view">
      <div className="ft-grid">
        {CARDS.filter((card) => !card.ptOnly || isPersonalMode).map((card) =>
          card.comingSoon ? (
            <div key={card.key} className="ft-card ft-card-soon" aria-disabled="true">
              <span className="ft-soon-badge">Em breve</span>
              <div className="ft-card-ico" aria-hidden="true">{card.icon}</div>
              <div className="ft-card-title">{card.title}</div>
              <div className="ft-card-desc">{card.desc}</div>
            </div>
          ) : (
            <button
              key={card.key}
              type="button"
              className="ft-card ft-card-active"
              onClick={() => setScreen(card.key as FerramentasScreen)}
            >
              <div className="ft-card-ico" aria-hidden="true">{card.icon}</div>
              <div className="ft-card-title">{card.title}</div>
              <div className="ft-card-desc">{card.desc}</div>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
