import { useEffect, useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { calcularIdade } from '../../types/aluno';
import { FotosComparativas } from '../avaliacao/FotosComparativas';
import {
  carregarRascunhoOnline,
  limparRascunhoOnline,
  salvarRascunhoOnline,
  type OnlineAssessmentDraft,
} from '../../lib/onlineAssessmentDraftStore';
import { inferirSexoDoGenero } from '../../utils/pollock7';
import { hojeISODate, paraDateInputValue } from '../../utils/timelineDate';
import {
  INSTRUCOES_GERAIS,
  criarPontosCircunferenciaOnline,
  montarAvaliacaoOnline,
  pontosCircunferenciaDoRegistro,
  validarAltura,
  validarPeso,
  validarValorCircunferencia,
  type OnlinePointFormState,
} from '../../utils/onlineAssessment';
import type { PhysicalAssessment } from '../../types/assessment';
import { OnlineAnthropometry } from './OnlineAnthropometry';
import { OnlineCircumferenceGuide } from './OnlineCircumferenceGuide';
import { OnlineQuestionnaire } from './OnlineQuestionnaire';
import { OnlineReview } from './OnlineReview';
import './ClientesView.css';
import './OnlineAssessmentForm.css';

const STEPS = ['instrucoes', 'dados', 'antropometria', 'circunferencias', 'indicadores', 'fotos', 'questionario', 'revisao'] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  instrucoes: 'Instruções',
  dados: 'Dados',
  antropometria: 'Peso/Altura',
  circunferencias: 'Medidas',
  indicadores: 'Indicadores',
  fotos: 'Fotos',
  questionario: 'Questionário',
  revisao: 'Revisão',
};

interface OnlineFormState {
  data: string;
  maoDominante: 'direita' | 'esquerda' | '';
  objetivoPrincipal: string;
  nivelExperiencia: string;
  peso: string;
  altura: string;
  pontosCircunferencia: OnlinePointFormState[];
  questionario: PhysicalAssessment['questionnaire'];
}

function estadoInicial(): OnlineFormState {
  return {
    data: hojeISODate(),
    maoDominante: '',
    objetivoPrincipal: '',
    nivelExperiencia: '',
    peso: '',
    altura: '',
    pontosCircunferencia: criarPontosCircunferenciaOnline(),
    questionario: {},
  };
}

/** Reconstrói o estado do wizard a partir de uma avaliação já salva —
 *  usado só no modo edição (`assessmentExistente`). */
function estadoDoRegistro(assessment: PhysicalAssessment): OnlineFormState {
  return {
    data: paraDateInputValue(assessment.date),
    maoDominante: assessment.questionnaire?.maoDominante ?? '',
    objetivoPrincipal: assessment.questionnaire?.objetivoPrincipal ?? '',
    nivelExperiencia: assessment.questionnaire?.nivelExperiencia ?? '',
    peso: String(assessment.anthropometry.peso),
    altura: String(assessment.anthropometry.altura),
    pontosCircunferencia: pontosCircunferenciaDoRegistro(assessment.circumferences),
    questionario: assessment.questionnaire ?? {},
  };
}

function gerarAssessmentId(): string {
  return `af-online-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface OnlineAssessmentFormProps {
  alunoId: string;
  onCancel: () => void;
  onSave: (assessment: PhysicalAssessment) => Promise<boolean> | boolean;
  /** Presente = modo edição (só o Personal chega aqui, via "Editar" na
   *  timeline). Status/quem enviou/revisão originais são preservados —
   *  editar só corrige o conteúdo, nunca o histórico de quem fez o quê. */
  assessmentExistente?: PhysicalAssessment;
}

/**
 * Autoavaliação remota guiada — protocolo Online. O próprio Aluno
 * preenche em etapas curtas, com rascunho salvo localmente a cada avanço
 * de etapa (localStorage, `onlineAssessmentDraftStore`), pra poder
 * continuar depois de sair no meio. Só na etapa final ("Enviar
 * avaliação") o registro vira `PhysicalAssessment` de verdade e é
 * persistido — o rascunho nunca vai pro Firestore.
 */
export function OnlineAssessmentForm({ alunoId, onCancel, onSave, assessmentExistente }: OnlineAssessmentFormProps) {
  const editando = !!assessmentExistente;
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const idadeCadastro = calcularIdade(aluno?.dataNascimento);
  const sexoCadastro = inferirSexoDoGenero(aluno?.genero);

  const [assessmentId, setAssessmentId] = useState(() => assessmentExistente?.id ?? gerarAssessmentId());
  const [step, setStep] = useState<Step>(editando ? 'dados' : 'instrucoes');
  const [form, setForm] = useState<OnlineFormState>(() => (assessmentExistente ? estadoDoRegistro(assessmentExistente) : estadoInicial()));
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Carrega rascunho salvo (se houver) uma única vez, ao abrir — só faz
  // sentido no fluxo de autoavaliação do próprio Aluno, nunca ao editar.
  useEffect(() => {
    if (editando) return;
    const rascunho = carregarRascunhoOnline<OnlineFormState>(alunoId);
    if (rascunho) {
      setAssessmentId(rascunho.assessmentId);
      setStep(rascunho.step as Step);
      setForm(rascunho.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  function salvarRascunho(proximoStep: Step, dadosAtualizados?: OnlineFormState) {
    if (editando) return; // edição não usa rascunho local
    const draft: OnlineAssessmentDraft<OnlineFormState> = {
      assessmentId,
      step: proximoStep,
      updatedAt: new Date().toISOString(),
      data: dadosAtualizados ?? form,
    };
    salvarRascunhoOnline(alunoId, draft);
  }

  function irPara(proximoStep: Step) {
    setTentouAvancar(false);
    setStep(proximoStep);
    salvarRascunho(proximoStep);
  }

  const pesoNum = form.peso === '' ? undefined : Number(form.peso);
  const alturaNum = form.altura === '' ? undefined : Number(form.altura);
  const erroAntropometria = validarPeso(pesoNum) ?? validarAltura(alturaNum);
  const errosCircunferencia = form.pontosCircunferencia.some(
    (p) => validarValorCircunferencia(p.m1 === '' ? undefined : Number(p.m1)) || validarValorCircunferencia(p.m2 === '' ? undefined : Number(p.m2))
  );

  function handleAvancar() {
    setTentouAvancar(true);
    if (step === 'antropometria' && erroAntropometria) return;
    if (step === 'circunferencias' && errosCircunferencia) return;

    const idx = STEPS.indexOf(step);
    const proximo = STEPS[idx + 1];
    if (proximo) irPara(proximo);
  }

  function handleVoltar() {
    const idx = STEPS.indexOf(step);
    const anterior = STEPS[idx - 1];
    if (anterior) irPara(anterior);
    else onCancel();
  }

  function montar(status: PhysicalAssessment['status']) {
    const built = montarAvaliacaoOnline(
      alunoId,
      {
        assessmentId,
        data: form.data,
        maoDominante: form.maoDominante,
        objetivoPrincipal: form.objetivoPrincipal,
        nivelExperiencia: form.nivelExperiencia,
        peso: form.peso,
        altura: form.altura,
        pontosCircunferencia: form.pontosCircunferencia,
        questionario: form.questionario ?? {},
      },
      status ?? 'enviada'
    );
    // Editar corrige conteúdo, não reescreve quem enviou/revisou/quando foi criada.
    return assessmentExistente
      ? {
          ...built,
          createdAt: assessmentExistente.createdAt,
          status: assessmentExistente.status,
          submittedBy: assessmentExistente.submittedBy,
          review: assessmentExistente.review,
        }
      : built;
  }

  async function handleEnviar() {
    setEnviando(true);
    try {
      const assessment = montar(editando ? assessmentExistente!.status : 'enviada');
      const ok = await onSave(assessment);
      if (ok !== false && !editando) {
        limparRascunhoOnline(alunoId);
      }
    } finally {
      setEnviando(false);
    }
  }

  const idxAtual = STEPS.indexOf(step);
  const progresso = Math.round((idxAtual / (STEPS.length - 1)) * 100);

  // Objeto de preview (sem persistir) — usado nas etapas de Indicadores e
  // Revisão pra mostrar os valores calculados até aqui.
  const preview = pesoNum != null && alturaNum != null && !erroAntropometria ? montar('em_preenchimento') : null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="cli-detail-panel oa-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>{editando ? 'Editar Avaliação Online' : 'Avaliação Online'}</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="oa-progress">
          <div className="oa-progress-dots">
            {STEPS.map((s, i) => (
              <span key={s} className={`oa-dot${i <= idxAtual ? ' oa-dot--ativo' : ''}`} title={STEP_LABELS[s]} />
            ))}
          </div>
          <div className="oa-progress-bar">
            <div className="oa-progress-fill" style={{ width: `${progresso}%` }} />
          </div>
          <span className="oa-progress-pct">{progresso}%</span>
        </div>

        {step === 'instrucoes' && (
          <div className="oa-step">
            <h3 className="oa-step-title">Como realizar sua avaliação</h3>
            <ul className="oa-guia-lista">
              {INSTRUCOES_GERAIS.map((linha, i) => (
                <li key={i}>{linha}</li>
              ))}
            </ul>
          </div>
        )}

        {step === 'dados' && (
          <div className="oa-step">
            <h3 className="oa-step-title">Dados básicos</h3>
            <div className="oa-field">
              <label>Data da avaliação</label>
              <input type="date" value={form.data} max={hojeISODate()} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="oa-field">
              <label>Nome{aluno?.nome && <span className="oa-auto-tag">cadastro</span>}</label>
              <input type="text" value={aluno?.nome ?? ''} readOnly />
            </div>
            {idadeCadastro != null && (
              <div className="oa-field">
                <label>Idade<span className="oa-auto-tag">cadastro</span></label>
                <input type="text" value={`${idadeCadastro} anos`} readOnly />
              </div>
            )}
            {sexoCadastro && (
              <div className="oa-field">
                <label>Sexo<span className="oa-auto-tag">cadastro</span></label>
                <input type="text" value={sexoCadastro === 'M' ? 'Masculino' : 'Feminino'} readOnly />
              </div>
            )}
            <div className="oa-field">
              <label>Mão dominante</label>
              <div className="oa-toggle-row">
                <button type="button" className={`oa-toggle-opt${form.maoDominante === 'direita' ? ' active' : ''}`} onClick={() => setForm({ ...form, maoDominante: 'direita' })}>
                  Direita
                </button>
                <button type="button" className={`oa-toggle-opt${form.maoDominante === 'esquerda' ? ' active' : ''}`} onClick={() => setForm({ ...form, maoDominante: 'esquerda' })}>
                  Esquerda
                </button>
              </div>
            </div>
            <div className="oa-field">
              <label>Objetivo principal</label>
              <input type="text" value={form.objetivoPrincipal} onChange={(e) => setForm({ ...form, objetivoPrincipal: e.target.value })} placeholder="Ex: hipertrofia, emagrecimento…" />
            </div>
            <div className="oa-field">
              <label>Nível de experiência com treinamento</label>
              <input type="text" value={form.nivelExperiencia} onChange={(e) => setForm({ ...form, nivelExperiencia: e.target.value })} placeholder="Ex: iniciante, intermediário…" />
            </div>
          </div>
        )}

        {step === 'antropometria' && (
          <OnlineAnthropometry
            peso={form.peso}
            altura={form.altura}
            onChangePeso={(v) => setForm({ ...form, peso: v })}
            onChangeAltura={(v) => setForm({ ...form, altura: v })}
            mostrarErros={tentouAvancar}
          />
        )}

        {step === 'circunferencias' && (
          <OnlineCircumferenceGuide
            pontos={form.pontosCircunferencia}
            onChange={(pontos) => setForm({ ...form, pontosCircunferencia: pontos })}
            mostrarErros={tentouAvancar}
          />
        )}

        {step === 'indicadores' && (
          <div className="oa-step">
            <h3 className="oa-step-title">Indicadores calculados</h3>
            {preview ? (
              <OnlineReview assessment={preview} mode="aluno" />
            ) : (
              <p className="oa-note">Preencha peso e altura para ver os indicadores.</p>
            )}
          </div>
        )}

        {step === 'fotos' && (
          <div className="oa-step">
            <h3 className="oa-step-title">Fotos comparativas (opcional)</h3>
            <FotosComparativas alunoId={alunoId} assessmentId={assessmentId} />
          </div>
        )}

        {step === 'questionario' && (
          <OnlineQuestionnaire
            value={form.questionario ?? {}}
            onChange={(questionario) => setForm({ ...form, questionario })}
          />
        )}

        {step === 'revisao' &&
          (preview ? (
            <OnlineReview
              assessment={preview}
              mode="aluno"
              onVoltar={handleVoltar}
              onEnviar={handleEnviar}
              enviando={enviando}
              labelEnviar={editando ? 'Salvar alterações' : 'Enviar avaliação'}
            />
          ) : (
            <p className="oa-note">Volte e preencha peso e altura antes de enviar.</p>
          ))}

        {step !== 'revisao' && (
          <div className="oa-actions">
            <button type="button" className="btn btn-ghost" onClick={handleVoltar}>
              {idxAtual === 0 ? 'Cancelar' : 'Voltar'}
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAvancar}>
              Avançar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
