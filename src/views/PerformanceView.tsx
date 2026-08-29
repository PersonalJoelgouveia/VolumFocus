import { useState } from 'react';
import { ConsistencyGridCard } from '../components/shared/ConsistencyGridCard';
import { ForcaContent } from './ForcaView';
import { CardioContent } from './CardioView';
import '../components/shared/ConsistencyGridCard.css';

type PerfTab = 'forca' | 'cardio';

/**
 * Sucessor de #view-performance + _perfInit/switchPerfTab/perfOnViewOpen
 * (index.html ~2805-2858, ~4419-4466): hub que junta o grid de
 * consistência do mês (compartilhado pelas duas abas) com sub-abas Força
 * 1RM / Cardiorrespiratório.
 *
 * O original resolvia isso com uma gambiarra de DOM (migrar innerHTML de
 * #view-forca/#view-cardio pra dentro de si mesmo na primeira abertura).
 * Em React isso é só composição: ForcaContent/CardioContent são os
 * mesmos componentes usados pelas views standalone, sem o cabeçalho de
 * página duplicado — nenhuma duplicação de lógica ou estado.
 */
export function PerformanceView() {
  const [tab, setTab] = useState<PerfTab>('forca');

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Performance <span className="tag">TESTES & MÉTRICAS</span>
        </div>
      </div>

      <ConsistencyGridCard />

      <div className="perf-tabs">
        <button className={`perf-tab${tab === 'forca' ? ' active' : ''}`} onClick={() => setTab('forca')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4v6a6 6 0 0 0 12 0V4" />
            <line x1="4" y1="20" x2="20" y2="20" />
          </svg>
          Força 1RM
        </button>
        <button className={`perf-tab${tab === 'cardio' ? ' active' : ''}`} onClick={() => setTab('cardio')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Cardiorrespiratório
        </button>
      </div>

      <div className={`perf-panel${tab === 'forca' ? ' active' : ''}`}>
        <ForcaContent />
      </div>
      <div className={`perf-panel${tab === 'cardio' ? ' active' : ''}`}>
        <CardioContent />
      </div>
    </div>
  );
}
