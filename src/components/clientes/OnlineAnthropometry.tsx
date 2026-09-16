import { calcularIMC, classificarIMC, validarAltura, validarPeso } from '../../utils/onlineAssessment';
import './OnlineAssessmentForm.css';

interface OnlineAnthropometryProps {
  peso: string;
  altura: string;
  onChangePeso: (v: string) => void;
  onChangeAltura: (v: string) => void;
  mostrarErros: boolean;
}

/**
 * Peso + altura + IMC calculado automaticamente. O IMC é sempre mostrado
 * como relação peso/altura, nunca como medida direta de gordura corporal
 * — texto de aviso fixo abaixo do resultado (seção 4 do pedido).
 */
export function OnlineAnthropometry({ peso, altura, onChangePeso, onChangeAltura, mostrarErros }: OnlineAnthropometryProps) {
  const pesoNum = peso === '' ? undefined : Number(peso);
  const alturaNum = altura === '' ? undefined : Number(altura);
  const erroPeso = validarPeso(pesoNum);
  const erroAltura = validarAltura(alturaNum);

  const imc = pesoNum && alturaNum && !erroPeso && !erroAltura ? calcularIMC(pesoNum, alturaNum) : null;
  const classificacao = imc != null ? classificarIMC(imc) : null;

  return (
    <div className="oa-step">
      <h3 className="oa-step-title">Peso e altura</h3>

      <div className="oa-field">
        <label>Peso corporal (kg)</label>
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={0}
          value={peso}
          onChange={(e) => onChangePeso(e.target.value)}
          placeholder="Ex: 78.5"
        />
        {mostrarErros && erroPeso && <div className="oa-error">{erroPeso}</div>}
      </div>

      <div className="oa-field">
        <label>Altura (cm)</label>
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={0}
          value={altura}
          onChange={(e) => onChangeAltura(e.target.value)}
          placeholder="Ex: 175"
        />
        {mostrarErros && erroAltura && <div className="oa-error">{erroAltura}</div>}
      </div>

      {imc != null && classificacao && (
        <div className="oa-result">
          <div className="oa-result-row">
            <span>IMC</span>
            <strong>{imc.toFixed(1)}</strong>
          </div>
          <div className="oa-result-row">
            <span>Classificação</span>
            <strong>{classificacao.label}</strong>
          </div>
          <p className="oa-note">
            O IMC é um indicador de relação peso/altura e não deve ser usado isoladamente para inferir composição
            corporal. Fonte: {classificacao.fonte}.
          </p>
        </div>
      )}
    </div>
  );
}
