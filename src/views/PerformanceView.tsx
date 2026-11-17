import { useState } from 'react';
import { ConsistencyGridCard } from '../components/shared/ConsistencyGridCard';
import { XRayContent } from './DashboardView';
import '../components/shared/ConsistencyGridCard.css';

/**
 * Performance: grid de consistência do mês + submenu X-ray ao final.
 * Os testes de Força 1RM e Cardiorrespiratório vivem em Saúde > Avaliação
 * Física. O X-ray (análise semanal, volume, balanço agonista/antagonista)
 * mantém todas as funcionalidades — é o mesmo componente, só reposicionado.
 */
export function PerformanceView() {
  const [xrayOpen, setXrayOpen] = useState(true);

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Performance <span className="tag">MÉTRICAS</span>
        </div>
      </div>

      <ConsistencyGridCard />

      <div className="perf-tabs" style={{ marginTop: 24 }}>
        <button type="button" className={`perf-tab${xrayOpen ? ' active' : ''}`} aria-expanded={xrayOpen} onClick={() => setXrayOpen((v) => !v)}>
          X-ray <span style={{ opacity: 0.7, fontWeight: 400 }}>· Análise &amp; Resumo Unificado</span> {xrayOpen ? '▾' : '▸'}
        </button>
      </div>
      {xrayOpen && <XRayContent />}
    </div>
  );
}
