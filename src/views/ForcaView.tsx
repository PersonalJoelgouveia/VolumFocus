/**
 * Stub tipado de view — implementação completa prevista nas Fases 3-4.
 * Mantém a separação de views pedida na Fase 2 sem inventar comportamento
 * que ainda não foi migrado do monolito.
 */
export function ForcaView() {
  return (
    <div>
      <div className="sec-row">
        <div className="page-title">Força 1RM</div>
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
        Teste de Carga Máxima — em migração (Fase 3/4).
      </p>
    </div>
  );
}
