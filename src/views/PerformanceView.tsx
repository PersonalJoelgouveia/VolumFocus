import { ConsistencyGridCard } from '../components/shared/ConsistencyGridCard';
import { XRayContent } from './DashboardView';
import '../components/shared/ConsistencyGridCard.css';

/**
 * Performance: grid de consistência do mês e, ao final, todo o conteúdo do
 * X-ray (antigo item da sidebar). Os testes de Força 1RM e Cardiorrespiratório
 * vivem em Saúde > Avaliação Física.
 */
export function PerformanceView() {
  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Performance <span className="tag">MÉTRICAS</span>
        </div>
      </div>

      <ConsistencyGridCard />

      <div className="sec-row" style={{ marginTop: 28 }}>
        <div className="page-title">
          X-ray <span className="tag">ANÁLISE &amp; RESUMO UNIFICADO</span>
        </div>
      </div>
      <XRayContent />
    </div>
  );
}
