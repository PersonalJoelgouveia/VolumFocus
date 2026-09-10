import { useState } from 'react';
import { useCalorieStore } from '../../store/useCalorieStore';
import { useUIStore } from '../../store/useUIStore';
import './TimerModals.css';

/** Sucessor de `#met-modal` (index.html ~3590-3604) e metConfirm()/metDecline(). */
export function MetWeightModal() {
  const isOpen = useCalorieStore((s) => s.isWeightModalOpen);
  const closeWeightModal = useCalorieStore((s) => s.closeWeightModal);
  const setBodyWeightKg = useCalorieStore((s) => s.setBodyWeightKg);
  const savedWeight = useCalorieStore((s) => s.bodyWeightKg);
  const showToast = useUIStore((s) => s.showToast);

  const [value, setValue] = useState(savedWeight ? String(savedWeight) : '');

  if (!isOpen) return null;

  function handleConfirm() {
    const v = parseFloat(value);
    if (!v || v < 30 || v > 300) {
      showToast('Informe um peso válido (30–300 kg).', 'warning');
      return;
    }
    setBodyWeightKg(v);
    showToast('Cálculo calórico ativado!', 'success');
  }

  return (
    <div className="timer-modal-backdrop">
      <div className="met-card">
        <div className="met-icon">🔥</div>
        <div className="met-title">Estimar Gasto Calórico?</div>
        <div className="met-sub">
          Informe seu peso para calcular as calorias gastas em tempo real durante o treino (MET Musculação = 5.0).
        </div>
        <div className="met-input-row">
          <input
            type="number"
            placeholder="75"
            min={30}
            max={300}
            step={0.5}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="met-input-unit">kg</span>
        </div>
        <div className="met-btns">
          <button className="btn btn-ghost" onClick={closeWeightModal}>
            Agora não
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Calcular
          </button>
        </div>
      </div>
    </div>
  );
}
