import { useState } from 'react';
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
}

const CARDS: ToolCard[] = [
  { key: 'timer', icon: '⏱', title: 'Timer', desc: 'Timer de intervalos: preparação, exercício e descanso.' },
  { key: 'agenda', icon: '📅', title: 'Agenda', desc: 'Organize seus compromissos e sessões.', comingSoon: true },
  { key: 'anotacoes', icon: '📝', title: 'Anotações', desc: 'Prontuário de acompanhamento do treinamento por cliente.' },
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
 * types/trainingNote.ts), independente das demais ferramentas. Os demais
 * cards continuam só visuais ("Em breve"), sem onClick nem estado.
 */
export function FerramentasView() {
  const [screen, setScreen] = useState<FerramentasScreen>('hub');

  if (screen === 'timer') {
    return <TimerToolView onVoltar={() => setScreen('hub')} />;
  }

  if (screen === 'modelos') {
    return <ModelosToolView onVoltar={() => setScreen('hub')} />;
  }

  if (screen === 'anotacoes') {
    return <AnotacoesToolView onVoltar={() => setScreen('hub')} />;
  }

  return (
    <div className="ft-view">
      <div className="ft-grid">
        {CARDS.map((card) =>
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
