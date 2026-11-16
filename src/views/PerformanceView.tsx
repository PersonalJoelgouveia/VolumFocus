import { useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';

/**
 * Performance foi transferida para Saúde > Avaliação Física (sub-abas
 * Força 1RM e Cardiorrespiratório). Os dados (jg3_strength_records e
 * jg3_cardio_data) não mudaram de lugar — só a navegação. Este ViewId é
 * mantido apenas como redirecionamento, para não quebrar atalhos antigos.
 */
export function PerformanceView() {
  const setActiveView = useUIStore((s) => s.setActiveView);
  useEffect(() => {
    setActiveView('saude');
  }, [setActiveView]);
  return null;
}
