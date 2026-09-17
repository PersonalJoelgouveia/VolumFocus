/**
 * Protocolo de Avaliação Online — autoavaliação remota guiada.
 *
 * Módulo puro: nenhuma dependência de React, nenhum I/O. Todo cálculo e
 * toda validação de negócio do protocolo moram aqui — os componentes só
 * coletam input e exibem o resultado (mesmo padrão de utils/pollock7.ts
 * e utils/bioimpedance.ts).
 *
 * ================= FONTES CIENTÍFICAS =================
 * - Cintura e quadril: protocolo antropométrico padronizado da OMS —
 *   "WHO STEPS Surveillance Manual" (World Health Organization), seção de
 *   medidas antropométricas. Identificado nos dados como
 *   `measurementMethod: 'WHO_STEPS'`.
 * - IMC (classificação para adultos): OMS — "Physical status: the use and
 *   interpretation of anthropometry" (WHO Technical Report Series 854,
 *   1995) e BMI classification da OMS, de uso corrente. O IMC é só uma
 *   relação peso/altura — NUNCA é apresentado aqui como medida direta de
 *   gordura corporal.
 * - RCE (relação cintura-estatura): faixas de referência amplamente
 *   citadas na literatura (ex. Ashwell & Gibson, "Waist-to-height ratio as
 *   an indicator of 'early health risk': simpler and more predictive than
 *   using a 'matrix' based on BMI and waist circumference", BMJ Open,
 *   2016) — usa-se aqui só a leitura "< 0,50 / 0,50–0,59 / ≥ 0,60" já
 *   exigida no pedido, sem inventar novo ponto de corte.
 * - RCQ (relação cintura-quadril): classificação de risco de DCNTs (Doenças
 *   Crônicas Não Transmissíveis) por sexo biológico — pontos de corte da
 *   OMS ("Waist Circumference and Waist-Hip Ratio: Report of a WHO Expert
 *   Consultation", 2008): Homens ≤0,90 baixo / 0,90–0,99 moderado / ≥1,00
 *   alto; Mulheres ≤0,80 baixo / 0,80–0,84 moderado / ≥0,85 alto. Só é
 *   aplicada quando o sexo biológico é conhecido — sem sexo, mostra-se
 *   apenas o valor numérico (ver `classificarRCQ`/`INSTRUCAO_RCQ`).
 *
 * IMPORTANTE — o que este módulo NÃO faz:
 * - Não estima percentual de gordura a partir de peso/circunferências.
 * - Não cria "score científico" de qualidade da medição — só um
 *   checklist descritivo (`avaliarQualidadeMedicao`).
 * - O limiar de discrepância entre 1ª/2ª medida (`LIMIAR_DISCREPANCIA_CM`)
 *   NÃO vem de nenhuma fonte citada acima — é uma heurística prática de
 *   qualidade de dado (não uma classificação de risco), documentada como
 *   suposição explícita. Ajustável se o Personal quiser outro valor.
 */

import type {
  AssessmentResults,
  CircumferenceMeasurement,
  CircumferenceSide,
  OnlineAssessmentStatus,
  OnlineQuestionnaireData,
  PhysicalAssessment,
  SkinfoldSet,
} from '../types/assessment';

/* ============================================================
 * Antropometria básica — IMC
 * ============================================================ */

export function calcularIMC(pesoKg: number, alturaCm: number): number {
  const alturaM = alturaCm / 100;
  return pesoKg / alturaM ** 2;
}

export interface ClassificacaoIMC {
  label: string;
  fonte: string;
}

/**
 * Classificação de IMC para adultos (OMS). Não deve ser usada para
 * gestantes, atletas de alta massa muscular, crianças/adolescentes ou
 * idosos — a interface deve deixar claro que é uma relação peso/altura,
 * não uma medida de composição corporal.
 */
export function classificarIMC(imc: number): ClassificacaoIMC {
  const fonte = 'OMS — classificação de IMC para adultos';
  if (imc < 18.5) return { label: 'Abaixo do peso', fonte };
  if (imc < 25) return { label: 'Peso normal', fonte };
  if (imc < 30) return { label: 'Sobrepeso', fonte };
  if (imc < 35) return { label: 'Obesidade grau I', fonte };
  if (imc < 40) return { label: 'Obesidade grau II', fonte };
  return { label: 'Obesidade grau III', fonte };
}

/* ============================================================
 * Indicadores derivados — RCQ e RCE
 * ============================================================ */

/** Relação cintura-quadril. Ambos os valores precisam estar em cm. */
export function calcularRCQ(cinturaCm: number, quadrilCm: number): number {
  return cinturaCm / quadrilCm;
}

/** Relação cintura-estatura. Ambos os valores precisam estar em cm —
 *  nunca misturar cm com m sem converter. */
export function calcularRCE(cinturaCm: number, alturaCm: number): number {
  return cinturaCm / alturaCm;
}

/**
 * Deriva a RCQ a partir das circunferências já registradas na avaliação
 * (procura pelos ids padrão `cintura`/`quadril` — ver `STANDARD_CIRCUMFERENCES`
 * em utils/circumference.ts). Retorna `undefined` quando cintura e/ou
 * quadril não foram medidos nesta avaliação — nunca inventa o valor.
 * Usado pelos protocolos Dobras/Bioimpedância, que já coletam
 * circunferências via `CircumferenceForm` mas não calculavam RCQ (só o
 * protocolo Online calculava, com seus próprios pontos).
 */
export function derivarRCQDeCircunferencias(circumferences: CircumferenceMeasurement): number | undefined {
  const cintura = circumferences.find((c) => c.id === 'cintura')?.valor;
  const quadril = circumferences.find((c) => c.id === 'quadril')?.valor;
  if (cintura == null || quadril == null) return undefined;
  return calcularRCQ(cintura, quadril);
}

export interface ClassificacaoRCE {
  label: string;
  /** Presente quando a classificação não deve ser usada como principal
   *  indicador de risco (ex.: IMC ≥ 35 kg/m²) — exibir junto ao resultado. */
  limitacao?: string;
}

/**
 * Interpretação da RCE — apresentada sempre como "indicador de
 * adiposidade central", nunca como diagnóstico ("saudável"/"doente").
 * Quando o IMC já está ≥ 35 kg/m², a RCE não deve ser usada isoladamente
 * como classificação de risco (sinalizado via `limitacao`).
 */
export function classificarRCE(rce: number, imc?: number): ClassificacaoRCE {
  let label: string;
  if (rce < 0.5) label = 'Cintura abaixo da metade da altura (faixa de referência inferior)';
  else if (rce < 0.6) label = 'Adiposidade central aumentada';
  else label = 'Adiposidade central elevada';

  const limitacao =
    imc != null && imc >= 35
      ? 'IMC ≥ 35 kg/m² — a RCE não deve ser usada isoladamente como principal classificação de risco.'
      : undefined;

  return { label, limitacao };
}

export interface ClassificacaoRCQ {
  label: 'Baixo' | 'Moderado' | 'Alto';
  fonte: string;
}

/**
 * Classifica o risco de DCNTs (Doenças Crônicas Não Transmissíveis) a
 * partir da RCQ, por sexo biológico — pontos de corte da OMS (2008).
 * Sem sexo biológico conhecido não há como classificar (não inventar):
 * o chamador deve tratar `undefined` mostrando só o valor numérico da RCQ.
 */
export function classificarRCQ(rcq: number, sexoBiologico?: 'M' | 'F'): ClassificacaoRCQ | undefined {
  if (sexoBiologico == null) return undefined;
  const fonte = 'OMS (2008) — risco de DCNTs por RCQ, faixas por sexo biológico';
  if (sexoBiologico === 'M') {
    if (rcq <= 0.9) return { label: 'Baixo', fonte };
    if (rcq <= 0.99) return { label: 'Moderado', fonte };
    return { label: 'Alto', fonte };
  }
  // sexoBiologico === 'F'
  if (rcq <= 0.8) return { label: 'Baixo', fonte };
  if (rcq <= 0.84) return { label: 'Moderado', fonte };
  return { label: 'Alto', fonte };
}

/** Texto de apoio pra UI — usado quando o sexo biológico não está
 *  disponível na avaliação, então só o valor numérico é exibido. */
export const INSTRUCAO_RCQ =
  'A Relação Cintura-Quadril é classificada em risco Baixo/Moderado/Alto de DCNTs por sexo biológico (OMS, 2008). Sem o sexo biológico informado, mostramos só o valor numérico.';

/* ============================================================
 * Qualidade da autoaferição — 1ª/2ª medida, discrepância
 * ============================================================ */

/** Heurística prática (não uma classificação de risco) — ver nota de
 *  fonte no topo do arquivo. */
export const LIMIAR_DISCREPANCIA_CM = 1;

export function calcularMedia(m1: number, m2: number): number {
  return (m1 + m2) / 2;
}

/** true quando a diferença entre as duas medidas é grande o bastante pra
 *  recomendar repetição — nunca substitui a medida sozinho. */
export function temDiscrepanciaSignificativa(m1: number, m2: number): boolean {
  return Math.abs(m1 - m2) > LIMIAR_DISCREPANCIA_CM;
}

export interface QualidadeMedicaoPonto {
  duasMedidasRealizadas: boolean;
  diferencaPequena: boolean;
}

/** Checklist descritivo por ponto — nunca vira um score numérico único. */
export function avaliarQualidadePonto(m1: number | undefined, m2: number | undefined): QualidadeMedicaoPonto {
  const duasMedidasRealizadas = m1 != null && m2 != null && !Number.isNaN(m1) && !Number.isNaN(m2);
  const diferencaPequena = duasMedidasRealizadas ? !temDiscrepanciaSignificativa(m1 as number, m2 as number) : false;
  return { duasMedidasRealizadas, diferencaPequena };
}

/* ============================================================
 * Pontos de circunferência do protocolo Online
 * ============================================================ */

export interface OnlineCircumferencePoint {
  id: string;
  nome: string;
  lado: CircumferenceSide;
  /** true só para cintura/quadril — têm protocolo metodológico próprio
   *  (WHO STEPS) e guia visual específico. */
  padronizada: boolean;
  measurementMethod?: string;
}

/** Os 11 pontos coletados no protocolo Online, na ordem de exibição.
 *  Ids compartilhados com utils/circumference.ts (exceto 'pescoco', novo)
 *  — assim as séries entram direto no Dashboard/Comparação existentes,
 *  que casam por id/nome, sem precisar de nenhuma mudança lá além de
 *  registrar o grupo "Pescoço". */
export const ONLINE_CIRCUMFERENCE_POINTS: OnlineCircumferencePoint[] = [
  { id: 'cintura', nome: 'Cintura', lado: 'none', padronizada: true, measurementMethod: 'WHO_STEPS' },
  { id: 'quadril', nome: 'Quadril', lado: 'none', padronizada: true, measurementMethod: 'WHO_STEPS' },
  { id: 'pescoco', nome: 'Pescoço', lado: 'none', padronizada: false },
  { id: 'bracoDireito', nome: 'Braço direito', lado: 'direito', padronizada: false },
  { id: 'bracoEsquerdo', nome: 'Braço esquerdo', lado: 'esquerdo', padronizada: false },
  { id: 'torax', nome: 'Tórax', lado: 'none', padronizada: false },
  { id: 'abdomen', nome: 'Abdômen', lado: 'none', padronizada: false },
  { id: 'coxaDireita', nome: 'Coxa direita', lado: 'direito', padronizada: false },
  { id: 'coxaEsquerda', nome: 'Coxa esquerda', lado: 'esquerdo', padronizada: false },
  { id: 'panturrilhaDireita', nome: 'Panturrilha direita', lado: 'direito', padronizada: false },
  { id: 'panturrilhaEsquerda', nome: 'Panturrilha esquerda', lado: 'esquerdo', padronizada: false },
];

/** Estado de formulário de um ponto de circunferência no protocolo Online
 *  — sempre 1ª/2ª medida (strings, podem estar vazias enquanto o aluno
 *  preenche), nunca só um valor único como nos protocolos presenciais. */
export interface OnlinePointFormState {
  id: string;
  nome: string;
  lado: CircumferenceSide;
  padronizada: boolean;
  measurementMethod?: string;
  m1: string;
  m2: string;
  personalizada?: boolean;
}

/** Estado inicial: os 11 pontos padrão, sem valor ainda. */
export function criarPontosCircunferenciaOnline(): OnlinePointFormState[] {
  return ONLINE_CIRCUMFERENCE_POINTS.map((p) => ({ ...p, m1: '', m2: '', personalizada: false }));
}

/** Nova medida personalizada vazia (seção "Permitir medidas adicionais personalizadas"). */
export function criarPontoPersonalizadoOnline(): OnlinePointFormState {
  return {
    id: `circ-online-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: '',
    lado: 'none',
    padronizada: false,
    m1: '',
    m2: '',
    personalizada: true,
  };
}

/**
 * Converte o estado de formulário para `CircumferenceMeasurement`
 * (types/assessment.ts) — só pontos com pelo menos uma medida preenchida
 * entram; o valor persistido é sempre a média das duas medidas quando
 * ambas existem, ou a única medida disponível quando só uma foi tirada
 * (nunca inventa a segunda). `measurementMethod` só vai para cintura e
 * quadril (WHO_STEPS) — os demais ficam sem método explícito, como já
 * fazem os protocolos presenciais.
 */
export function paraRegistroHistoricoOnline(pontos: OnlinePointFormState[]): CircumferenceMeasurement {
  return pontos
    .filter((p) => p.m1 !== '' || p.m2 !== '')
    .map((p) => {
      const n1 = p.m1 === '' ? undefined : Number(p.m1);
      const n2 = p.m2 === '' ? undefined : Number(p.m2);
      const valor = n1 != null && n2 != null ? calcularMedia(n1, n2) : ((n1 ?? n2) as number);
      return {
        id: p.id,
        nome: p.nome,
        valor,
        unidade: 'cm' as const,
        lado: p.lado,
        personalizada: p.personalizada,
        measurementMethod: p.measurementMethod,
      };
    });
}

/* ============================================================
 * Instruções (texto simples, sem jargão médico desnecessário)
 * ============================================================ */

export const INSTRUCOES_GERAIS: string[] = [
  'Realize as medidas preferencialmente no mesmo horário das avaliações anteriores.',
  'Use pouca roupa e condições parecidas com as avaliações anteriores.',
  'Use a balança sobre uma superfície firme.',
  'Use uma fita métrica não elástica.',
  'Mantenha a postura natural, sem se esticar ou encolher.',
  'Não prenda a respiração durante a medida.',
  'Não aperte demais a fita métrica contra a pele.',
  'Sempre siga o mesmo protocolo nas próximas avaliações.',
  'Se possível, peça ajuda de outra pessoa para conferir a fita.',
];

export const INSTRUCOES_CINTURA: string[] = [
  'Localize a última costela que dá pra sentir com o dedo.',
  'Localize o topo do osso do quadril (crista ilíaca).',
  'Posicione a fita no ponto médio entre esses dois pontos.',
  'Mantenha a fita na horizontal, ao redor de todo o corpo.',
  'Ajuste a fita sem comprimir a pele.',
  'Fique em pé, postura ereta, braços relaxados.',
  'Respire normalmente e faça a leitura logo depois de soltar o ar.',
];

export const INSTRUCOES_QUADRIL: string[] = [
  'Fique em pé, postura ereta.',
  'Mantenha a fita na horizontal.',
  'Meça na maior circunferência da região do quadril/glúteos.',
];

export const INSTRUCOES_PESCOCO: string[] = [
  'Mantenha o pescoço em posição neutra, olhando para frente.',
  'Mantenha a fita na horizontal.',
  'Não comprima o tecido — a fita deve tocar a pele sem apertar.',
];

/* ============================================================
 * Validação — dados básicos e antropometria
 * ============================================================ */

export interface OnlineValidationError {
  field: string;
  message: string;
}

export function validarPeso(pesoKg: number | undefined): string | undefined {
  if (pesoKg == null || Number.isNaN(pesoKg)) return 'Informe o peso.';
  if (pesoKg <= 0) return 'Peso deve ser maior que zero.';
  if (pesoKg > 300) return 'Peso informado é implausível.';
  return undefined;
}

export function validarAltura(alturaCm: number | undefined): string | undefined {
  if (alturaCm == null || Number.isNaN(alturaCm)) return 'Informe a altura.';
  if (alturaCm <= 0) return 'Altura deve ser maior que zero.';
  if (alturaCm > 250) return 'Altura informada é implausível.';
  return undefined;
}

/** Mesma faixa de plausibilidade usada nos protocolos presenciais
 *  (utils/circumference.ts: 0–300cm), aplicada por ponto aqui. */
export function validarValorCircunferencia(valor: number | undefined): string | undefined {
  if (valor == null) return undefined; // ponto opcional — nem toda medida é tirada
  if (Number.isNaN(valor)) return 'Valor inválido.';
  if (valor < 0) return 'Valor não pode ser negativo.';
  if (valor > 300) return 'Valor fora da faixa plausível (máx. 300cm).';
  return undefined;
}

import { SKINFOLD_SITES } from './pollock7';
import { dateInputParaISO } from './timelineDate';

/* ============================================================
 * Montagem do registro final (PhysicalAssessment) — protocolo Online
 * ============================================================ */

export interface OnlineWizardData {
  assessmentId: string;
  /** 'YYYY-MM-DD' (valor de `<input type="date">`) — data em que a
   *  autoavaliação foi realizada, não a data de envio. */
  data: string;
  maoDominante: 'direita' | 'esquerda' | '';
  objetivoPrincipal: string;
  nivelExperiencia: string;
  peso: string;
  altura: string;
  pontosCircunferencia: OnlinePointFormState[];
  questionario: OnlineQuestionnaireData;
}

function montarNotasBasicas(wizard: OnlineWizardData): string {
  const partes: string[] = [];
  if (wizard.maoDominante) partes.push(`Mão dominante: ${wizard.maoDominante === 'direita' ? 'Direita' : 'Esquerda'}`);
  if (wizard.objetivoPrincipal) partes.push(`Objetivo: ${wizard.objetivoPrincipal}`);
  if (wizard.nivelExperiencia) partes.push(`Nível de experiência: ${wizard.nivelExperiencia}`);
  return partes.join(' · ');
}

/**
 * Reconstrói o estado de formulário a partir de um registro já salvo —
 * usado só ao abrir uma avaliação Online existente pra edição. Como só a
 * MÉDIA final é persistida (não a 1ª/2ª medida originais), a edição
 * reabre com as duas medidas iguais à média salva — limitação conhecida,
 * não uma perda de dado nova introduzida aqui.
 */
export function pontosCircunferenciaDoRegistro(circumferences: CircumferenceMeasurement): OnlinePointFormState[] {
  const base = criarPontosCircunferenciaOnline();
  const porId = new Map(base.map((p) => [p.id, p]));
  const extras: OnlinePointFormState[] = [];

  for (const c of circumferences) {
    const valorStr = String(c.valor);
    const existente = porId.get(c.id);
    if (existente) {
      existente.m1 = valorStr;
      existente.m2 = valorStr;
    } else {
      extras.push({
        id: c.id,
        nome: c.nome,
        lado: c.lado,
        padronizada: false,
        measurementMethod: c.measurementMethod,
        m1: valorStr,
        m2: valorStr,
        personalizada: true,
      });
    }
  }

  return [...base, ...extras];
}

/**
 * Monta o `PhysicalAssessment` completo a partir do estado do wizard.
 * Nome/data de nascimento/sexo NÃO são duplicados aqui — já vivem no
 * cadastro do Aluno (seção 3 do pedido: "não duplicar informações
 * desnecessariamente"). RCQ/RCE só entram quando cintura (e quadril, no
 * caso da RCQ) foram de fato medidos — nunca inventados. Mão dominante/
 * objetivo/nível de experiência vão tanto pro texto legível de `notes`
 * quanto, de forma estruturada, pra `questionnaire` — assim reabrir a
 * avaliação pra edição não precisa reinterpretar texto livre.
 */
export function montarAvaliacaoOnline(
  alunoId: string,
  wizard: OnlineWizardData,
  status: OnlineAssessmentStatus
): PhysicalAssessment {
  const now = new Date().toISOString();
  const pesoNum = Number(wizard.peso);
  const alturaNum = Number(wizard.altura);
  const imc = calcularIMC(pesoNum, alturaNum);
  const circunferencias = paraRegistroHistoricoOnline(wizard.pontosCircunferencia);

  const cintura = circunferencias.find((c) => c.id === 'cintura')?.valor;
  const quadril = circunferencias.find((c) => c.id === 'quadril')?.valor;
  const relacaoCinturaQuadril = cintura != null && quadril != null ? calcularRCQ(cintura, quadril) : undefined;
  const relacaoCinturaEstatura = cintura != null ? calcularRCE(cintura, alturaNum) : undefined;

  const skinfolds = SKINFOLD_SITES.reduce((acc, site) => {
    acc[site] = { measurement1: 0, measurement2: 0, measurement3: 0, average: 0 };
    return acc;
  }, {} as SkinfoldSet);

  const notas = montarNotasBasicas(wizard);

  const results: AssessmentResults = { relacaoCinturaQuadril, relacaoCinturaEstatura };

  return {
    id: wizard.assessmentId,
    alunoId,
    date: dateInputParaISO(wizard.data),
    protocol: 'online',
    notes: notas || undefined,
    anthropometry: { peso: pesoNum, altura: alturaNum, imc },
    circumferences: circunferencias,
    skinfolds,
    results,
    createdAt: now,
    updatedAt: now,
    status,
    submittedBy: 'aluno',
    questionnaire: {
      ...wizard.questionario,
      maoDominante: wizard.maoDominante || undefined,
      objetivoPrincipal: wizard.objetivoPrincipal || undefined,
      nivelExperiencia: wizard.nivelExperiencia || undefined,
    },
  };
}

/* ============================================================
 * Saúde e segurança — triagem inicial simples (nunca diagnóstico)
 * ============================================================ */

export interface TriagemSaudeItem {
  key: string;
  pergunta: string;
}

/** Perguntas simples, estilo triagem PAR-Q — nunca geram diagnóstico
 *  automático, só sinalizam quando vale conversar com um profissional. */
export const TRIAGEM_SAUDE_ITENS: TriagemSaudeItem[] = [
  { key: 'condicaoCardiaca', pergunta: 'Algum médico já disse que você tem um problema no coração?' },
  { key: 'dorPeitoRepouso', pergunta: 'Você sente dor no peito quando pratica atividade física ou em repouso?' },
  { key: 'tonturaDesequilibrio', pergunta: 'Você perde o equilíbrio por tontura ou já perdeu a consciência?' },
  { key: 'problemaOsseoArticular', pergunta: 'Você tem algum problema ósseo ou articular que pode piorar com exercício?' },
  { key: 'medicacaoPressaoCoracao', pergunta: 'Você toma remédio para pressão arterial ou para o coração?' },
  { key: 'outraRazaoNaoExercitar', pergunta: 'Existe algum outro motivo para você não praticar atividade física?' },
];

export const MENSAGEM_ORIENTACAO_PROFISSIONAL =
  'Considere conversar com um profissional de saúde antes de iniciar ou modificar seu programa de exercícios.';

/** true se qualquer resposta da triagem indicar necessidade de orientação
 *  profissional. Nunca gera diagnóstico — só decide se a mensagem neutra
 *  acima deve ser exibida. */
export function precisaOrientacaoProfissional(respostas: Record<string, boolean> | undefined): boolean {
  if (!respostas) return false;
  return Object.values(respostas).some(Boolean);
}
