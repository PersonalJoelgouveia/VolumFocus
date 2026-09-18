import { useState } from 'react';
import { VisaoGeralTab } from './saude/VisaoGeralTab';
import { AvaliacaoFisicaTab } from './saude/AvaliacaoFisicaTab';
import { ExamesMedicosTab } from './saude/ExamesMedicosTab';
import { WearablesPanel } from './saude/WearablesPanel';
import type { SaudeTab } from './saude/saudeTabs';
import './SaudeView.css';

const TABS: { key: SaudeTab; label: string; icon: string }[] = [
  { key: 'visao-geral', label: 'Visão Geral', icon: '🩺' },
  { key: 'avaliacao', label: 'Avaliação Física', icon: '📋' },
  { key: 'exames', label: 'Exames Médicos', icon: '🧪' },
  { key: 'wearables', label: 'Wearables', icon: '⌚' },
];

/**
 * Hub "Saúde" — sucessor da antiga view de Wearables (que virou a aba
 * `WearablesPanel`, sem mudança de lógica). Reorganização puramente de
 * navegação: Avaliação Física saiu do botão 📋 da Topbar (UserMenu) e
 * virou aba aqui, ocupando o workspace central igual às demais views —
 * nada de cálculo, dado, Firebase ou fluxo do Personal em Clientes foi
 * tocado (ver AvaliacaoFisicaTab.tsx).
 */
export function SaudeView() {
  const [tab, setTab] = useState<SaudeTab>('visao-geral');

  return (
    <div className="sh-view">
      <div className="sh-tabs" role="tablist" aria-label="Navegação de Saúde">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`sh-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="sh-tab-content">
        {tab === 'visao-geral' && <VisaoGeralTab onNavigate={setTab} />}
        {tab === 'avaliacao' && <AvaliacaoFisicaTab onVoltar={() => setTab('visao-geral')} />}
        {tab === 'exames' && <ExamesMedicosTab />}
        {tab === 'wearables' && <WearablesPanel />}
      </div>
    </div>
  );
}
