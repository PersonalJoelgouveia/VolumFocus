import { useState } from 'react';
import {
  INSTRUCOES_CINTURA,
  INSTRUCOES_PESCOCO,
  INSTRUCOES_QUADRIL,
  avaliarQualidadePonto,
  calcularMedia,
  criarPontoPersonalizadoOnline,
  temDiscrepanciaSignificativa,
  validarValorCircunferencia,
  type OnlinePointFormState,
} from '../../utils/onlineAssessment';
import './OnlineAssessmentForm.css';

interface OnlineCircumferenceGuideProps {
  pontos: OnlinePointFormState[];
  onChange: (pontos: OnlinePointFormState[]) => void;
  mostrarErros: boolean;
}

const GUIA_POR_ID: Record<string, string[]> = {
  cintura: INSTRUCOES_CINTURA,
  quadril: INSTRUCOES_QUADRIL,
  pescoco: INSTRUCOES_PESCOCO,
};

/**
 * "Medidas corporais" — cada ponto permite 1ª medida, 2ª medida e média
 * final calculada automaticamente. Cintura e quadril têm guia visual e
 * método (WHO_STEPS) próprios; os demais são medidas de acompanhamento.
 * Nunca substitui a medida automaticamente sem avisar — só mostra um
 * alerta pedindo pra repetir quando a diferença é grande.
 */
export function OnlineCircumferenceGuide({ pontos, onChange, mostrarErros }: OnlineCircumferenceGuideProps) {
  const [guiaAberto, setGuiaAberto] = useState<string | null>(null);

  function atualizarPonto(id: string, campo: 'm1' | 'm2', valor: string) {
    onChange(pontos.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)));
  }

  function atualizarNomePersonalizado(id: string, nome: string) {
    onChange(pontos.map((p) => (p.id === id ? { ...p, nome } : p)));
  }

  function adicionarPersonalizada() {
    onChange([...pontos, criarPontoPersonalizadoOnline()]);
  }

  function removerPersonalizada(id: string) {
    onChange(pontos.filter((p) => p.id !== id));
  }

  const padronizados = pontos.filter((p) => p.padronizada);
  const complementares = pontos.filter((p) => !p.padronizada && !p.personalizada);
  const personalizadas = pontos.filter((p) => p.personalizada);

  function renderPonto(ponto: OnlinePointFormState) {
    const n1 = ponto.m1 === '' ? undefined : Number(ponto.m1);
    const n2 = ponto.m2 === '' ? undefined : Number(ponto.m2);
    const media = n1 != null && n2 != null ? calcularMedia(n1, n2) : null;
    const qualidade = avaliarQualidadePonto(n1, n2);
    const discrepancia = n1 != null && n2 != null && temDiscrepanciaSignificativa(n1, n2);
    const erroM1 = mostrarErros ? validarValorCircunferencia(n1) : undefined;
    const erroM2 = mostrarErros ? validarValorCircunferencia(n2) : undefined;
    const guia = GUIA_POR_ID[ponto.id];

    return (
      <div key={ponto.id} className="oa-circ-card">
        <div className="oa-circ-header">
          <span className="oa-circ-nome">
            {ponto.personalizada ? (
              <input
                type="text"
                className="oa-circ-nome-input"
                placeholder="Nome da medida"
                value={ponto.nome}
                onChange={(e) => atualizarNomePersonalizado(ponto.id, e.target.value)}
              />
            ) : (
              ponto.nome
            )}
          </span>
          {ponto.measurementMethod && <span className="oa-circ-metodo">WHO STEPS</span>}
          {ponto.personalizada && (
            <button type="button" className="oa-circ-remover" onClick={() => removerPersonalizada(ponto.id)} aria-label="Remover medida">
              ×
            </button>
          )}
        </div>

        {guia && (
          <button type="button" className="oa-guia-toggle" onClick={() => setGuiaAberto(guiaAberto === ponto.id ? null : ponto.id)}>
            {guiaAberto === ponto.id ? 'Ocultar guia ▲' : 'Como medir ▼'}
          </button>
        )}
        {guia && guiaAberto === ponto.id && (
          <ul className="oa-guia-lista">
            {guia.map((linha, i) => (
              <li key={i}>{linha}</li>
            ))}
          </ul>
        )}

        <div className="oa-circ-inputs">
          <div>
            <label>1ª medida (cm)</label>
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={ponto.m1}
              onChange={(e) => atualizarPonto(ponto.id, 'm1', e.target.value)}
            />
            {erroM1 && <div className="oa-error">{erroM1}</div>}
          </div>
          <div>
            <label>2ª medida (cm)</label>
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={ponto.m2}
              onChange={(e) => atualizarPonto(ponto.id, 'm2', e.target.value)}
            />
            {erroM2 && <div className="oa-error">{erroM2}</div>}
          </div>
          <div>
            <label>Média</label>
            <div className="oa-circ-media">{media != null ? `${media.toFixed(1)} cm` : '—'}</div>
          </div>
        </div>

        {discrepancia && (
          <div className="oa-alert">As duas medidas apresentam diferença significativa. Recomendamos repetir a medição.</div>
        )}
        {!discrepancia && qualidade.duasMedidasRealizadas && <div className="oa-quality-ok">✓ 2 medidas · ✓ diferença pequena</div>}
      </div>
    );
  }

  return (
    <div className="oa-step">
      <h3 className="oa-step-title">Medidas corporais</h3>
      <p className="oa-note">Todas as medidas em centímetros (cm). Tire duas medidas de cada ponto — a média é calculada sozinha.</p>

      <div className="oa-circ-group-title">Medidas padronizadas</div>
      {padronizados.map(renderPonto)}

      <div className="oa-circ-group-title">Medidas complementares</div>
      {complementares.map(renderPonto)}

      {personalizadas.length > 0 && (
        <>
          <div className="oa-circ-group-title">Medidas personalizadas</div>
          {personalizadas.map(renderPonto)}
        </>
      )}

      <button type="button" className="btn btn-ghost oa-add-custom" onClick={adicionarPersonalizada}>
        + Medida personalizada
      </button>
    </div>
  );
}
