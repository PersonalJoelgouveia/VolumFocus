/**
 * Stub tipado de view — implementação completa prevista nas Fases 3-4.
 * Mantém a separação de views pedida na Fase 2 sem inventar comportamento
 * que ainda não foi migrado do monolito.
 */
export function CardioView() {
  return (
    <div>
      <div className="sec-row">
        <div className="page-title">Cardio VO2</div>
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
        VO2 Máx & Zonas de Treinamento — em migração (Fase 3/4).
      </p>
    </div>
  );
}
