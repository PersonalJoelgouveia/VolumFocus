import { useCardioTestStore } from '../../store/useCardioTestStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { useUIStore } from '../../store/useUIStore';
import { CARDIO_PROTOCOLS } from '../../utils/cardioVo2';

function protocolLabel(modality: 'esteira' | 'bike', protocol: string): string {
  return CARDIO_PROTOCOLS[modality]?.find((p) => p.value === protocol)?.label ?? protocol;
}

/**
 * Bloco 4: Evolução/Histórico — não existe no HTML de referência
 * (jg3_cardio_data guardava só o último resultado, sem histórico).
 * Lê de useCardioTestStore (agora um array) e mostra o delta entre o
 * último e o penúltimo teste — "Último × Anterior: +Xml/kg/min / +Y%".
 */
export function CardioHistoryCard() {
  const testes = useCardioTestStore((s) => s.testes);
  const remover = useCardioTestStore((s) => s.remover);
  const showToast = useUIStore((s) => s.showToast);

  const [ultimo, anterior] = testes;

  async function handleRemover(id: string) {
    const ok = await useConfirmStore.getState().ask('Remover este teste do histórico?', {
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    remover(id);
    showToast('🗑️ Teste removido', 'success');
  }

  return (
    <div className="card">
      <div className="card-title">📈 Evolução &amp; Histórico</div>

      {testes.length === 0 ? (
        <div className="cardio-empty">Nenhum teste realizado ainda. Seus resultados aparecem aqui à medida que forem salvos.</div>
      ) : (
        <>
          {ultimo && anterior && (
            <div className="cardio-hist-delta">
              <span className="cardio-hist-delta-icon">{ultimo.vo2 >= anterior.vo2 ? '📈' : '📉'}</span>
              <div className="cardio-hist-delta-text">
                Último × Anterior:{' '}
                <span className={`cardio-hist-delta-value${ultimo.vo2 < anterior.vo2 ? ' cardio-hist-delta-neg' : ''}`}>
                  {ultimo.vo2 >= anterior.vo2 ? '+' : ''}
                  {(ultimo.vo2 - anterior.vo2).toFixed(1)} ml/kg/min
                </span>{' '}
                <span className={`cardio-hist-delta-value${ultimo.vo2 < anterior.vo2 ? ' cardio-hist-delta-neg' : ''}`}>
                  ({ultimo.vo2 >= anterior.vo2 ? '+' : ''}
                  {(((ultimo.vo2 - anterior.vo2) / anterior.vo2) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          <div className="cardio-hist-list">
            {testes.map((t) => (
              <div className="cardio-hist-item" key={t.id}>
                <div className="cardio-hist-item-left">
                  <span className="cardio-hist-vo2">{t.vo2.toFixed(1)}</span>
                  <div>
                    <div className={`cardio-level-badge ${t.classification.cls}`} style={{ padding: '2px 7px', fontSize: '0.6rem' }}>
                      {t.classification.label}
                    </div>
                    <div className="cardio-hist-date">
                      {new Date(t.data).toLocaleDateString('pt-BR')} · {protocolLabel(t.inputs.modality, t.inputs.protocol)}
                    </div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" title="Remover" onClick={() => handleRemover(t.id)}>
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
