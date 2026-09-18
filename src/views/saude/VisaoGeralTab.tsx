import { useUIStore } from '../../store/useUIStore';
import type { SaudeTab } from './saudeTabs';

interface OverviewCard {
  tab: SaudeTab;
  icon: string;
  title: string;
  desc: string;
  /** Some cards depend on o papel de quem está logado — ver render abaixo. */
  ptOnly?: boolean;
}

const CARDS: OverviewCard[] = [
  {
    tab: 'avaliacao',
    icon: '📋',
    title: 'Avaliação Física',
    desc: 'Histórico, evolução e comparativo das suas avaliações (Dobras, Bioimpedância, Online).',
  },
  {
    tab: 'exames',
    icon: '🧪',
    title: 'Exames Médicos',
    desc: 'Em breve — espaço reservado pra exames laboratoriais e laudos.',
  },
  {
    tab: 'wearables',
    icon: '⌚',
    title: 'Wearables',
    desc: 'Frequência cardíaca, passos, distância e calorias sincronizados do seu relógio/app de saúde.',
  },
];

/**
 * Aba "Visão Geral" do hub Saúde — ponto de entrada só de navegação
 * (nenhum dado novo é buscado/calculado aqui), com um atalho por
 * subárea. Cada aba de destino já resolve sozinha o que mostrar pro
 * papel de quem está logado (ex.: Avaliação Física redireciona o Personal
 * pra Clientes).
 */
export function VisaoGeralTab({ onNavigate }: { onNavigate: (tab: SaudeTab) => void }) {
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  return (
    <div className="sh-overview-grid">
      {CARDS.map((card) => (
        <button key={card.tab} type="button" className="sh-overview-card" onClick={() => onNavigate(card.tab)}>
          <div className="sh-overview-ico" aria-hidden="true">{card.icon}</div>
          <div className="sh-overview-title">{card.title}</div>
          <div className="sh-overview-desc">
            {card.tab === 'avaliacao' && isPersonalMode
              ? 'Acesse pelo perfil de cada aluno na tela Clientes.'
              : card.desc}
          </div>
        </button>
      ))}
    </div>
  );
}
