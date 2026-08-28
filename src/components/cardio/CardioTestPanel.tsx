import { useEffect, useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useCardioTestStore } from '../../store/useCardioTestStore';
import { getElapsedMs, getRemainingMs, useCooperTimerStore } from '../../store/useCooperTimerStore';
import { CARDIO_PROTOCOLS, runCardioCalculation } from '../../utils/cardioVo2';
import type { CardioModality, CardioProtocol, CardioTestInputs, CardioTestResult } from '../../types/cardioTest';
import { CardioResultCard } from './CardioResultCard';

function fmtClock(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Bloco 3: Testes Cardiovasculares — sucessor do card "Dados & Protocolo
 * de Teste" + cardioCalculate() (index.html ~3109-3207, ~8937-9004).
 * Painel inline colapsável (sem modal, como pedido). Protocolo Cooper 12
 * min troca os campos manuais por um timer baseado em timestamp
 * (useCooperTimerStore) — sobrevive a navegar pra outra view e voltar,
 * já que o tempo restante é sempre recalculado a partir de `startedAt`.
 */
export function CardioTestPanel() {
  const showToast = useUIStore((s) => s.showToast);
  const salvarTeste = useCardioTestStore((s) => s.salvar);

  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [age, setAge] = useState('30');
  const [weight, setWeight] = useState('75');
  const [fcRest, setFcRest] = useState('60');
  const [vo2Ergo, setVo2Ergo] = useState('');
  const [modality, setModality] = useState<CardioModality>('esteira');
  const [protocol, setProtocol] = useState<CardioProtocol>('bruce');

  const [bruceTime, setBruceTime] = useState('12.30');
  const [bruceFc, setBruceFc] = useState('178');
  const [astrandLoad, setAstrandLoad] = useState('100');
  const [astrandFc, setAstrandFc] = useState('150');
  const [storerLoad, setStorerLoad] = useState('200');
  const [storerFc, setStorerFc] = useState('180');
  const [cooperDistance, setCooperDistance] = useState('');

  const [lastResult, setLastResult] = useState<CardioTestResult | null>(null);

  const protocolOptions = CARDIO_PROTOCOLS[modality];

  // Modalidade mudou e o protocolo atual não existe mais nessa lista — reseta pro primeiro.
  useEffect(() => {
    if (!protocolOptions.find((p) => p.value === protocol)) setProtocol(protocolOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modality]);

  const cooperStartedAt = useCooperTimerStore((s) => s.startedAt);
  const cooperPausedAt = useCooperTimerStore((s) => s.pausedAt);
  const cooperFinished = useCooperTimerStore((s) => s.finished);
  const startCooper = useCooperTimerStore((s) => s.start);
  const pauseCooper = useCooperTimerStore((s) => s.pause);
  const resumeCooper = useCooperTimerStore((s) => s.resume);
  const finishCooperNow = useCooperTimerStore((s) => s.finishNow);
  const resetCooper = useCooperTimerStore((s) => s.reset);

  const [, forceTick] = useState(0);
  useEffect(() => {
    if (protocol !== 'cooper12' || !cooperStartedAt || cooperPausedAt || cooperFinished) return;
    const id = setInterval(() => {
      const remaining = getRemainingMs(useCooperTimerStore.getState());
      if (remaining <= 0) {
        useCooperTimerStore.getState().finishNow();
        showToast('⏰ 12 minutos! Pare e informe a distância percorrida.');
      }
      forceTick((n) => n + 1);
    }, 250);
    return () => clearInterval(id);
  }, [protocol, cooperStartedAt, cooperPausedAt, cooperFinished, showToast]);

  const cooperRemaining = getRemainingMs(useCooperTimerStore.getState());
  const cooperElapsed = getElapsedMs(useCooperTimerStore.getState());
  const cooperRunning = !!cooperStartedAt && !cooperPausedAt && !cooperFinished;
  const cooperWarn = cooperRunning && cooperRemaining <= 60_000;

  function buildInputs(): CardioTestInputs {
    return {
      gender,
      age: parseFloat(age) || 30,
      weight: parseFloat(weight) || 70,
      fcRest: parseFloat(fcRest) || 60,
      vo2Ergo: vo2Ergo ? parseFloat(vo2Ergo) : null,
      modality,
      protocol,
      bruceTime,
      bruceFc: bruceFc ? parseFloat(bruceFc) : null,
      astrandLoad: parseFloat(astrandLoad) || 0,
      astrandFc: parseFloat(astrandFc) || 0,
      storerLoad: parseFloat(storerLoad) || 0,
      storerFc: storerFc ? parseFloat(storerFc) : null,
      cooperDistance: parseFloat(cooperDistance) || 0,
    };
  }

  function handleCalcular() {
    if (protocol === 'cooper12' && (!cooperFinished || !cooperDistance)) {
      return showToast('⚠️ Finalize o timer e informe a distância percorrida.', 'warning');
    }
    const inputs = buildInputs();
    const calc = runCardioCalculation(inputs);
    const result: CardioTestResult = {
      id: new Date().toISOString(),
      data: new Date().toISOString(),
      inputs,
      ...calc,
    };
    salvarTeste(result);
    setLastResult(result);
    showToast('✅ Teste salvo no histórico!', 'success');
    if (protocol === 'cooper12') {
      resetCooper();
      setCooperDistance('');
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div
        className="card-title"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        <span>🫀 Testes Cardiovasculares</span>
        <button className="btn btn-primary btn-sm cardio-test-toggle-btn" style={{ width: 'auto' }} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? '✕ Fechar' : '+ Iniciar Teste'}
        </button>
      </div>

      {open && (
        <div className="cardio-form" style={{ marginTop: 16 }}>
          <div className="form-group">
            <label>Gênero</label>
            <div className="cardio-toggle-row">
              <div className={`cardio-toggle-opt${gender === 'M' ? ' active' : ''}`} onClick={() => setGender('M')}>
                Masculino
              </div>
              <div className={`cardio-toggle-opt${gender === 'F' ? ' active' : ''}`} onClick={() => setGender('F')}>
                Feminino
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Idade</label>
              <input type="number" inputMode="numeric" min={10} max={100} value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Peso (kg)</label>
              <input type="number" inputMode="decimal" min={30} max={250} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              FC Repouso (bpm)
              <span className="cardio-tooltip" title="Meça em repouso total, ao acordar">?</span>
            </label>
            <input type="number" inputMode="numeric" min={30} max={120} value={fcRest} onChange={(e) => setFcRest(e.target.value)} />
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              VO2 Máx Ergoespirometria{' '}
              <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>
                opcional
              </span>
            </label>
            <input type="number" inputMode="decimal" min={0} max={100} step={0.1} placeholder="Ex: 48.5 (ml/kg/min)" value={vo2Ergo} onChange={(e) => setVo2Ergo(e.target.value)} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0' }} />

          <div className="grid-2">
            <div className="form-group">
              <label>Modalidade</label>
              <select value={modality} onChange={(e) => setModality(e.target.value as CardioModality)}>
                <option value="esteira">Esteira</option>
                <option value="bike">Bicicleta</option>
              </select>
            </div>
            <div className="form-group">
              <label>Protocolo</label>
              <select value={protocol} onChange={(e) => setProtocol(e.target.value as CardioProtocol)}>
                {protocolOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {protocol === 'bruce' && (
            <div className="grid-2">
              <div className="form-group">
                <label>Tempo Total (min.seg)</label>
                <input type="text" inputMode="decimal" placeholder="Ex: 12.30" value={bruceTime} onChange={(e) => setBruceTime(e.target.value)} />
              </div>
              <div className="form-group">
                <label>FC Final (bpm)</label>
                <input type="number" inputMode="numeric" min={80} max={220} value={bruceFc} onChange={(e) => setBruceFc(e.target.value)} />
              </div>
            </div>
          )}

          {protocol === 'astrand' && (
            <div className="grid-2">
              <div className="form-group">
                <label>{modality === 'bike' ? 'Carga no Estágio (Watts)' : 'Velocidade no Estágio (km/h)'}</label>
                <input type="number" inputMode="decimal" min={1} value={astrandLoad} onChange={(e) => setAstrandLoad(e.target.value)} />
              </div>
              <div className="form-group">
                <label>FC no Estágio (bpm)</label>
                <input type="number" inputMode="numeric" min={80} max={220} value={astrandFc} onChange={(e) => setAstrandFc(e.target.value)} />
              </div>
            </div>
          )}

          {protocol === 'storer' && (
            <div className="grid-2">
              <div className="form-group">
                <label>Carga Final Atingida (Watts)</label>
                <input type="number" inputMode="numeric" min={20} max={500} value={storerLoad} onChange={(e) => setStorerLoad(e.target.value)} />
              </div>
              <div className="form-group">
                <label>FC Final (bpm)</label>
                <input type="number" inputMode="numeric" min={80} max={220} value={storerFc} onChange={(e) => setStorerFc(e.target.value)} />
              </div>
            </div>
          )}

          {protocol === 'cooper12' && (
            <div className="cooper-timer-wrap">
              <div className={`cooper-timer-display${cooperWarn ? ' cooper-timer-warn' : ''}${cooperFinished ? ' cooper-timer-done' : ''}`}>
                {cooperFinished ? '00:00' : fmtClock(cooperRemaining)}
              </div>
              <div className="cooper-timer-hint">
                {!cooperStartedAt
                  ? 'Corra o mais longe possível em 12 minutos e informe a distância ao final.'
                  : cooperFinished
                    ? '✅ Tempo esgotado — informe a distância percorrida abaixo.'
                    : cooperPausedAt
                      ? 'Pausado'
                      : `Decorrido: ${fmtClock(cooperElapsed)}`}
              </div>

              {!cooperFinished && (
                <div className="cooper-timer-controls">
                  {!cooperStartedAt ? (
                    <button className="btn btn-primary" onClick={startCooper}>
                      ▶ Iniciar Teste
                    </button>
                  ) : cooperPausedAt ? (
                    <button className="btn btn-primary" onClick={resumeCooper}>
                      ▶ Retomar
                    </button>
                  ) : (
                    <button className="btn btn-ghost" onClick={pauseCooper}>
                      ⏸ Pausar
                    </button>
                  )}
                  {cooperStartedAt && (
                    <button className="btn btn-ghost" onClick={finishCooperNow}>
                      ⏹ Finalizar Agora
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={resetCooper} title="Zerar timer">
                    🔄
                  </button>
                </div>
              )}

              {cooperFinished && (
                <div className="cooper-distance-form">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Distância Percorrida (m)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="Ex: 2400"
                      value={cooperDistance}
                      onChange={(e) => setCooperDistance(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {protocol !== 'cooper12' && (
            <button className="btn btn-primary btn-full" style={{ marginTop: 6 }} onClick={handleCalcular}>
              Calcular VO2 Máx &amp; Zonas
            </button>
          )}
          {protocol === 'cooper12' && cooperFinished && (
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={handleCalcular}>
              Calcular VO2 Máx &amp; Zonas
            </button>
          )}
        </div>
      )}

      {lastResult && (
        <div style={{ marginTop: open ? 18 : 16 }}>
          <CardioResultCard result={lastResult} />
        </div>
      )}
    </div>
  );
}
