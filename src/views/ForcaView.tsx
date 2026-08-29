import { useState } from 'react';
import { ProtocolAccordion } from '../components/forca/ProtocolAccordion';
import { StrCalcCard } from '../components/forca/StrCalcCard';
import type { StrCalcOutcome } from '../components/forca/StrCalcCard';
import { StrResultCard } from '../components/forca/StrResultCard';
import { StrRecordsCard } from '../components/forca/StrRecordsCard';
import { StrZonesCard } from '../components/forca/StrZonesCard';
import '../components/forca/ForcaView.css';

/**
 * Sucessor de #view-forca (index.html ~2862-3066): accordion de
 * protocolo, grid de 3 colunas (calcular / resultado / recordes) e a
 * tabela de zonas percentuais de prescrição — mesmas 3 fórmulas de 1RM
 * (Epley/Brzycki/Lombardi) + híbrida, mesmo slider de RIR, mesmos níveis.
 */
export function ForcaView() {
  const [result, setResult] = useState<StrCalcOutcome | null>(null);

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Força &amp; 1RM <span className="tag">1RM MULTI-FÓRMULA</span>
        </div>
      </div>

      <ProtocolAccordion />

      <div className="str-main-grid">
        <StrCalcCard onCalculated={setResult} />
        <StrResultCard result={result} />
        <StrRecordsCard />
      </div>

      <StrZonesCard oneRM={result?.oneRM ?? null} />
    </div>
  );
}
