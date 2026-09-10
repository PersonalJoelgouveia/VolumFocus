import { useState } from 'react';
import { ProtocolAccordion } from '../components/forca/ProtocolAccordion';
import { StrCalcCard } from '../components/forca/StrCalcCard';
import type { StrCalcOutcome } from '../components/forca/StrCalcCard';
import { StrResultCard } from '../components/forca/StrResultCard';
import { StrRecordsCard } from '../components/forca/StrRecordsCard';
import { StrZonesCard } from '../components/forca/StrZonesCard';
import '../components/forca/ForcaView.css';

/**
 * Conteúdo de Força sem o cabeçalho de página — sucessor do miolo de
 * #view-forca (index.html ~2862-3066), reaproveitado tanto pela view
 * standalone (ForcaView, abaixo) quanto pela sub-aba "Força 1RM" de
 * Performance (equivalente ao `perf-forca-content` do original, que
 * migrava o innerHTML de view-forca sem o título duplicado).
 */
export function ForcaContent() {
  const [result, setResult] = useState<StrCalcOutcome | null>(null);

  return (
    <>
      <ProtocolAccordion />

      <div className="str-main-grid">
        <StrCalcCard onCalculated={setResult} />
        <StrResultCard result={result} />
        <StrRecordsCard />
      </div>

      <StrZonesCard oneRM={result?.oneRM ?? null} />
    </>
  );
}

/** Sucessor de #view-forca — mesma fórmula 1RM multi-fórmula, com o título de página. */
export function ForcaView() {
  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Força &amp; 1RM <span className="tag">1RM MULTI-FÓRMULA</span>
        </div>
      </div>
      <ForcaContent />
    </div>
  );
}
