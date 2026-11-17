import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Target } from 'lucide-react';
import { useStrengthStore } from '../../store/useStrengthStore';
import { STR_FORMULAS } from '../../utils/strengthCalc';
import { cargaAlvoDoTeste, estimarPesoIdeal, formatarCarga } from '../../utils/cargaAlvo';
import { parseDecimal, sanitizeDecimalInput } from '../../utils/decimalInput';
import '../timer/TimerModals.css';
import './CargaAlvoButton.css';

interface Props {
  exerciseName: string;
  /** Repetições prescritas na rotina — somente leitura. */
  reps: number;
}

/**
 * 🎯 Carga Alvo por exercício. Só LÊ o recorde de teste de força
 * (useStrengthStore) e as reps prescritas: nunca grava nem altera a carga
 * de trabalho nem a prescrição. Sem teste, abre "Estimar peso ideal"
 * (estimativa descartável, rotulada como tal — não vira teste).
 */
export function CargaAlvoButton({ exerciseName, reps }: Props) {
  const record = useStrengthStore((s) => s.records[exerciseName]);
  const [tip, setTip] = useState(false);
  const [modal, setModal] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const ptrRef = useRef<string>('mouse');
  const tipRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  const alvo = cargaAlvoDoTeste(record, reps);

  useEffect(() => {
    if (!tip) return;
    const close = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setTip(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [tip]);

  // Mantém o balão dentro da tela (celulares estreitos): desloca para a esquerda se vazar à direita.
  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    tipRef.current.style.transform = 'translateX(0)';
    const r = tipRef.current.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    setShift(r.right > vw - 8 ? Math.min(r.left - 8, r.right - (vw - 8)) : 0);
  }, [tip]);

  if (!(reps >= 1)) return null;

  function onClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!alvo) {
      setTip(false);
      setModal(true);
    } else if (ptrRef.current !== 'mouse') {
      setTip((v) => !v);
    } else {
      setTip(true);
    }
  }

  return (
    <span
      ref={wrapRef}
      className="ca-wrap"
      onPointerEnter={(e) => {
        ptrRef.current = e.pointerType;
        if (e.pointerType === 'mouse') setTip(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setTip(false);
      }}
      onPointerDown={(e) => {
        ptrRef.current = e.pointerType;
      }}
    >
      <button type="button" className="ca-btn" aria-label="Carga alvo" title={alvo ? undefined : 'Estimar peso ideal'} onClick={onClick}>
        <Target size={14} aria-hidden="true" />
      </button>

      {tip && (
        <span ref={tipRef} className="ca-tip" role="tooltip" style={{ transform: `translateX(-${shift}px)` }} onClick={(e) => e.stopPropagation()}>
          {alvo ? (
            <>
              <strong className="ca-tip-val">{formatarCarga(alvo.carga)}</strong>
              <span className="ca-tip-sub">
                para {reps} {reps === 1 ? 'repetição' : 'repetições'} · baseado no teste de força (1RM {formatarCarga(alvo.oneRM)} ·{' '}
                {STR_FORMULAS[alvo.formula]?.label ?? alvo.formula}
                {alvo.dataTeste ? ` · ${alvo.dataTeste}` : ''})
              </span>
            </>
          ) : (
            <span className="ca-tip-sub">Sem teste de força para este exercício. Toque para estimar.</span>
          )}
        </span>
      )}

      {modal && <EstimarPesoIdealModal exerciseName={exerciseName} reps={reps} onClose={() => setModal(false)} />}
    </span>
  );
}

function EstimarPesoIdealModal({ exerciseName, reps, onClose }: { exerciseName: string; reps: number; onClose: () => void }) {
  const [carga, setCarga] = useState('');
  const [repsFeitas, setRepsFeitas] = useState('');
  const [rir, setRir] = useState('0');
  const [res, setRes] = useState<{ oneRM: number; carga: number } | null>(null);
  const [erro, setErro] = useState('');

  function calcular() {
    const c = parseDecimal(carga) ?? 0;
    const r = (parseInt(repsFeitas, 10) || 0) + (parseInt(rir, 10) || 0);
    const out = c > 0 && r >= 1 ? estimarPesoIdeal(c, r, reps) : null;
    setErro(out ? '' : 'Informe a carga e as repetições realizadas.');
    setRes(out);
  }

  return createPortal(
    <div className="timer-modal-backdrop" onClick={onClose}>
      <div className="met-card" role="dialog" aria-label="Estimar peso ideal" onClick={(e) => e.stopPropagation()}>
        <div className="met-icon">🎯</div>
        <div className="met-title">Estimar peso ideal</div>
        <div className="met-sub">
          {exerciseName} — prescrição: {reps} {reps === 1 ? 'repetição' : 'repetições'}. Ainda não há teste de força deste exercício. Informe uma série que você
          realizou para estimar a carga.
        </div>
        <div className="met-input-row">
          <input type="text" inputMode="decimal" placeholder="60" value={carga} onChange={(e) => setCarga(sanitizeDecimalInput(e.target.value))} aria-label="Carga usada (kg)" />
          <span className="met-input-unit">kg</span>
        </div>
        <div className="met-input-row">
          <input type="number" inputMode="numeric" min={1} max={30} placeholder="10" value={repsFeitas} onChange={(e) => setRepsFeitas(e.target.value)} aria-label="Repetições realizadas" />
          <span className="met-input-unit">reps feitas</span>
        </div>
        <div className="met-input-row">
          <input type="number" inputMode="numeric" min={0} max={5} value={rir} onChange={(e) => setRir(e.target.value)} aria-label="Repetições em reserva (RIR)" />
          <span className="met-input-unit">RIR</span>
        </div>
        {erro && <div className="ca-erro">{erro}</div>}
        {res && (
          <div className="ca-res">
            <div className="ca-res-val">{formatarCarga(res.carga)}</div>
            <div className="ca-res-sub">
              Carga ESTIMADA para {reps} reps (1RM estimado {formatarCarga(res.oneRM)}, fórmula Híbrida). Não é um teste de força salvo e não altera sua carga de
              treino.
            </div>
          </div>
        )}
        <div className="met-btns">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn btn-primary" onClick={calcular}>
            Estimar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
