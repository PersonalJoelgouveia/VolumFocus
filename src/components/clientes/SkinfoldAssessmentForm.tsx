import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { calcularIdade } from '../../types/aluno';
import {
  SKINFOLD_SITES,
  SKINFOLD_SITE_LABELS,
  calcMediaDobra,
  calcularPollock7,
  inferirSexoDoGenero,
  validarInputsPollock7,
  type Sex,
  type SkinfoldSite,
  type SkinfoldTriples,
  type SkinfoldAssessmentPayload,
  type Pollock7Result,
} from '../../utils/pollock7';
import './ClientesView.css';
import './SkinfoldAssessmentForm.css';

interface SkinfoldAssessmentFormProps {
  alunoId: string;
  onCancel: () => void;
  /** Chamado com o payload calculado ao salvar. Sem `onSave`, cai num
   *  console.log — quem renderiza decide como/onde persistir. */
  onSave?: (payload: SkinfoldAssessmentPayload) => void;
}

type TripleInputs = { m1: string; m2: string; m3: string };

function emptyTriples(): Record<SkinfoldSite, TripleInputs> {
  return SKINFOLD_SITES.reduce(
    (acc, site) => ({ ...acc, [site]: { m1: '', m2: '', m3: '' } }),
    {} as Record<SkinfoldSite, TripleInputs>
  );
}

/**
 * Formulário do protocolo "Dobras" (Jackson & Pollock 7 dobras).
 * Isolado por design: só orquestra estado de UI e delega todo o cálculo a
 * utils/pollock7.ts. Sexo/idade vêm do cadastro do aluno quando disponíveis,
 * mas seguem editáveis (dado por avaliação pode divergir do cadastro).
 */
export function SkinfoldAssessmentForm({ alunoId, onCancel, onSave }: SkinfoldAssessmentFormProps) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const idadeCadastro = calcularIdade(aluno?.dataNascimento);
  const sexoCadastro = inferirSexoDoGenero(aluno?.genero);

  const [sexo, setSexo] = useState<Sex | undefined>(sexoCadastro);
  const [idade, setIdade] = useState(idadeCadastro != null ? String(idadeCadastro) : '');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [triples, setTriples] = useState<Record<SkinfoldSite, TripleInputs>>(emptyTriples);
  const [tentouSalvar, setTentouSalvar] = useState(false);

  function setAfericao(site: SkinfoldSite, campo: keyof TripleInputs, valor: string) {
    setTriples((prev) => ({ ...prev, [site]: { ...prev[site], [campo]: valor } }));
  }

  const idadeNum = idade === '' ? undefined : Number(idade);
  const pesoNum = peso === '' ? undefined : Number(peso);
  const alturaNum = altura === '' ? undefined : Number(altura);
  const erroAltura =
    alturaNum == null ? 'Informe a altura.' : alturaNum <= 0 || alturaNum > 250 ? 'Altura implausível.' : undefined;

  const triplesInput = SKINFOLD_SITES.reduce(
    (acc, site) => {
      const t = triples[site];
      acc[site] = {
        m1: t.m1 === '' ? undefined : Number(t.m1),
        m2: t.m2 === '' ? undefined : Number(t.m2),
        m3: t.m3 === '' ? undefined : Number(t.m3),
      };
      return acc;
    },
    {} as Record<SkinfoldSite, { m1?: number; m2?: number; m3?: number }>
  );

  const erros = validarInputsPollock7(sexo, idadeNum, pesoNum, triplesInput);
  const podeCalcular = erros.length === 0;

  let resultado: Pollock7Result | null = null;
  if (podeCalcular) {
    const triplesCompletas = {} as SkinfoldTriples;
    for (const site of SKINFOLD_SITES) {
      const t = triples[site];
      const m1 = Number(t.m1);
      const m2 = Number(t.m2);
      const m3 = Number(t.m3);
      triplesCompletas[site] = { m1, m2, m3, media: calcMediaDobra(m1, m2, m3) };
    }
    resultado = calcularPollock7(sexo!, idadeNum!, pesoNum!, triplesCompletas);
  }

  function erroDoCampo(campo: string) {
    return tentouSalvar ? erros.find((e) => e.field === campo)?.message : undefined;
  }

  const podeSalvar = podeCalcular && !erroAltura;

  function handleSalvar() {
    setTentouSalvar(true);
    if (!podeSalvar || !resultado || !sexo || idadeNum == null || pesoNum == null || alturaNum == null) return;

    const triplesCompletas = {} as SkinfoldTriples;
    for (const site of SKINFOLD_SITES) {
      const t = triples[site];
      const m1 = Number(t.m1);
      const m2 = Number(t.m2);
      const m3 = Number(t.m3);
      triplesCompletas[site] = { m1, m2, m3, media: calcMediaDobra(m1, m2, m3) };
    }

    const payload: SkinfoldAssessmentPayload = {
      sexo,
      idade: idadeNum,
      pesoKg: pesoNum,
      alturaCm: alturaNum,
      triples: triplesCompletas,
      resultado,
    };
    if (onSave) {
      onSave(payload);
    } else {
      console.log('[SkinfoldAssessmentForm] Avaliação calculada — placeholder', payload);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="cli-detail-panel sf-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>Dobras Cutâneas (JP7)</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="sf-basics">
          <div className="sf-field">
            <label>Sexo biológico{sexoCadastro && <span className="sf-auto-tag">cadastro</span>}</label>
            <div className="sf-toggle-row">
              <button
                type="button"
                className={`sf-toggle-opt${sexo === 'M' ? ' active' : ''}`}
                onClick={() => setSexo('M')}
              >
                Masculino
              </button>
              <button
                type="button"
                className={`sf-toggle-opt${sexo === 'F' ? ' active' : ''}`}
                onClick={() => setSexo('F')}
              >
                Feminino
              </button>
            </div>
            {erroDoCampo('sexo') && <div className="sf-error">{erroDoCampo('sexo')}</div>}
          </div>

          <div className="sf-field">
            <label>Idade{idadeCadastro != null && <span className="sf-auto-tag">cadastro</span>}</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={idade}
              onChange={(e) => setIdade(e.target.value)}
              placeholder="anos"
            />
            {erroDoCampo('idade') && <div className="sf-error">{erroDoCampo('idade')}</div>}
          </div>

          <div className="sf-field">
            <label>Peso corporal (kg)</label>
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="Ex: 78.5"
            />
            {erroDoCampo('peso') && <div className="sf-error">{erroDoCampo('peso')}</div>}
          </div>

          <div className="sf-field">
            <label>Altura (cm)</label>
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              min={0}
              value={altura}
              onChange={(e) => setAltura(e.target.value)}
              placeholder="Ex: 175"
            />
            {tentouSalvar && erroAltura && <div className="sf-error">{erroAltura}</div>}
          </div>
        </div>

        <div className="sf-sites">
          {SKINFOLD_SITES.map((site) => {
            const t = triples[site];
            const media =
              t.m1 !== '' && t.m2 !== '' && t.m3 !== ''
                ? calcMediaDobra(Number(t.m1), Number(t.m2), Number(t.m3))
                : null;
            const erro = erroDoCampo(site);
            return (
              <div key={site} className={`sf-site-card${erro ? ' sf-site-card--erro' : ''}`}>
                <div className="sf-site-name">{SKINFOLD_SITE_LABELS[site]}</div>
                <div className="sf-site-inputs">
                  {(['m1', 'm2', 'm3'] as const).map((campo, i) => (
                    <input
                      key={campo}
                      type="number"
                      inputMode="decimal"
                      step={0.1}
                      min={0}
                      value={t[campo]}
                      onChange={(e) => setAfericao(site, campo, e.target.value)}
                      placeholder={`Aferição ${i + 1}`}
                      aria-label={`${SKINFOLD_SITE_LABELS[site]} — aferição ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="sf-site-media">
                  Média: {media != null ? `${media.toFixed(2)} mm` : '—'}
                </div>
                {erro && <div className="sf-error">{erro}</div>}
              </div>
            );
          })}
        </div>

        {resultado && (
          <div className="sf-result">
            <div className="sf-result-row">
              <span>Soma das 7 dobras</span>
              <strong>{resultado.somaDobras.toFixed(2)} mm</strong>
            </div>
            <div className="sf-result-row">
              <span>Densidade corporal</span>
              <strong>{resultado.densidadeCorporal.toFixed(4)} g/mL</strong>
            </div>
            <div className="sf-result-row">
              <span>% de gordura</span>
              <strong>{resultado.percentualGordura.toFixed(2)}%</strong>
            </div>
            <div className="sf-result-row">
              <span>Massa gorda</span>
              <strong>{resultado.massaGordaKg.toFixed(2)} kg</strong>
            </div>
            <div className="sf-result-row">
              <span>Massa magra</span>
              <strong>{resultado.massaMagraKg.toFixed(2)} kg</strong>
            </div>
            <div className="sf-result-row">
              <span>% de massa magra</span>
              <strong>{resultado.percentualMassaMagra.toFixed(2)}%</strong>
            </div>
          </div>
        )}

        {tentouSalvar && !podeSalvar && (
          <div className="sf-error sf-error-summary">Corrija os campos destacados para calcular o resultado.</div>
        )}

        <div className="sf-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSalvar}>
            Salvar avaliação
          </button>
        </div>
      </div>
    </div>
  );
}
