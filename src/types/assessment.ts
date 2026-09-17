/**
 * Domain model do módulo "Avaliação Física" — isolado por design.
 *
 * Não importa nem estende tipos de outros domínios (Aluno, Força, Cardio,
 * Saúde/Wearables). A única ligação com o resto do app é `alunoId`
 * (referência solta, sem import cruzado).
 */

/** Protocolo utilizado na avaliação. */
export type AssessmentProtocol = 'skinfold' | 'bioimpedance' | 'online' | 'custom';

/** Medição de dobra cutânea — 3 leituras + média. */
export interface SkinfoldMeasurement {
  measurement1: number;
  measurement2: number;
  measurement3: number;
  average: number;
}

/** Lado de uma circunferência, quando aplicável. */
export type CircumferenceSide = 'direito' | 'esquerdo' | 'none';

/** Só 'cm' é suportado hoje — campo existe desde já pra não exigir mudança
 *  de forma quando outra unidade for necessária. */
export type CircumferenceUnit = 'cm';

/** Uma circunferência registrada — padrão ou personalizada. `valor` só
 *  existe pra medidas de fato tiradas (histórico não guarda "não medido"). */
export interface CircumferenceEntry {
  id: string;
  nome: string;
  valor: number;
  unidade: CircumferenceUnit;
  lado: CircumferenceSide;
  personalizada?: boolean;
  /** Metodologia usada nesta medição específica (ex.: 'WHO_STEPS' para
   *  cintura/quadril no protocolo Online). Opcional — os protocolos
   *  presenciais (Dobras/Bioimpedância) não preenchem este campo hoje.
   *  Existe para nunca misturar, silenciosamente, medidas obtidas por
   *  métodos diferentes num mesmo histórico. */
  measurementMethod?: string;
}

/** Conjunto de circunferências de uma avaliação. Array (não mais
 *  Record<string, number>) pra preservar nome/unidade/lado por medida —
 *  necessário pra gráficos de evolução por ponto e pra medidas
 *  personalizadas com nome livre. */
export type CircumferenceMeasurement = CircumferenceEntry[];

/** Dados brutos de bioimpedância (varia por aparelho/fabricante). */
export type BioimpedanceData = Record<string, number>;

/** Dados antropométricos básicos. */
export interface Anthropometry {
  peso: number;
  altura: number;
  imc: number;
  /** Só o protocolo Dobras usa (entra na fórmula de Pollock 7). Opcional —
   *  os demais protocolos não preenchem. Guardado aqui (e não só derivado
   *  do cadastro do Aluno) pra edição de uma avaliação antiga não puxar a
   *  idade/sexo *atuais* do cadastro por engano. */
  sexoBiologico?: 'M' | 'F';
  idadeAnos?: number;
}

/** Resultados calculados da avaliação (composição corporal). Nem todo
 *  protocolo produz todos os campos — ex.: dobras cutâneas (JP7) não
 *  estima gordura visceral nem TMB, que dependem de outro método
 *  (bioimpedância). Por isso os dois ficam opcionais. */
export interface AssessmentResults {
  /** Opcional desde o protocolo Online: autoavaliação remota não estima
   *  composição corporal (seção 13 do protocolo — sem dobras, bioimpedância
   *  ou método laboratorial, não há uma equação validada pra usar). Dobras
   *  e Bioimpedância continuam sempre preenchendo estes campos. */
  percentualGordura?: number;
  percentualMassaGorda?: number;
  massaGordaKg?: number;
  percentualMassaLegra?: number;
  massaMagraKg?: number;
  gorduraVisceral?: number;
  metabolismoBasal?: number;
  /** Relação cintura-quadril (RCQ) — cintura/quadril, adimensional. Só o
   *  protocolo Online calcula hoje (requer cintura E quadril medidos com
   *  o mesmo método). */
  relacaoCinturaQuadril?: number;
  /** Relação cintura-estatura (RCE) — cintura/altura, adimensional. */
  relacaoCinturaEstatura?: number;
}

/** Status do fluxo de preenchimento — só se aplica ao protocolo Online
 *  (autoavaliação remota guiada). Dobras/Bioimpedância são preenchidos
 *  e salvos pelo Personal num único passo, sem rascunho intermediário,
 *  então ficam sem `status` (undefined = "concluída", implicitamente). */
export type OnlineAssessmentStatus = 'rascunho' | 'em_preenchimento' | 'enviada' | 'revisada';

/** Quem preencheu os dados originalmente. Só relevante para o protocolo
 *  Online — os demais são sempre preenchidos pelo Personal. */
export type AssessmentSubmitter = 'aluno' | 'personal';

/** Uma correção pontual feita pelo Personal na revisão — nunca sobrescreve
 *  o valor original informado/medido pelo Aluno silenciosamente. */
export interface AssessmentCorrection {
  field: string;
  originalValue: string;
  reviewedValue: string;
}

/** Metadados de revisão do Personal sobre uma Avaliação Online enviada
 *  pelo Aluno — só populado quando `status` vira 'revisada'. */
export interface AssessmentReview {
  reviewedBy: string;
  reviewedAt: string;
  reviewNote?: string;
  corrections?: AssessmentCorrection[];
}

/** Contexto complementar autorrelatado pelo Aluno (seção "Contexto da
 *  avaliação" do protocolo Online). Puramente informativo — nunca vira
 *  diagnóstico. Sempre exibido como "Informação relatada pelo aluno",
 *  nunca junto de "Medida objetiva". */
export interface OnlineQuestionnaireData {
  nivelAtividade?: string;
  frequenciaSemanalTreino?: number;
  modalidadePrincipal?: string;
  horasSono?: number;
  qualidadeSono?: string;
  tempoSentadoHoras?: number;
  frequenciaAerobica?: string;
  historicoTreinamento?: string;
  observacoes?: string;
  /** Dados básicos coletados fora do "Contexto da avaliação" (seção 3 do
   *  protocolo), mas guardados aqui pra edição de uma avaliação existente
   *  conseguir pré-preencher esses 3 campos sem precisar reinterpretar o
   *  texto livre de `notes`. */
  maoDominante?: 'direita' | 'esquerda' | '';
  objetivoPrincipal?: string;
  nivelExperiencia?: string;
  /** Triagem inicial simples (seção "Saúde e Segurança"). Nunca gera
   *  diagnóstico automático — só sinaliza, com linguagem neutra, que uma
   *  conversa com um profissional de saúde pode ser recomendável. */
  triagemSaude?: Record<string, boolean>;
}

/** Conjunto de dobras cutâneas do protocolo (7 pontos). */
export interface SkinfoldSet {
  peitoral: SkinfoldMeasurement;
  axilarMedia: SkinfoldMeasurement;
  triceps: SkinfoldMeasurement;
  subescapular: SkinfoldMeasurement;
  abdominal: SkinfoldMeasurement;
  supraIliaca: SkinfoldMeasurement;
  coxa: SkinfoldMeasurement;
}

/** Registro completo de uma Avaliação Física. */
export interface PhysicalAssessment {
  id: string;
  alunoId: string;
  date: string | Date;
  protocol: AssessmentProtocol;
  evaluator?: string;
  notes?: string;
  anthropometry: Anthropometry;
  circumferences: CircumferenceMeasurement;
  skinfolds: SkinfoldSet;
  bioimpedance?: BioimpedanceData;
  results: AssessmentResults;
  createdAt: string | Date;
  updatedAt: string | Date;
  /** Só populado no protocolo Online — ausente = avaliação presencial,
   *  sempre "concluída" no ato de salvar. */
  status?: OnlineAssessmentStatus;
  /** Quem preencheu os dados originalmente. */
  submittedBy?: AssessmentSubmitter;
  /** Contexto complementar autorrelatado — só no protocolo Online. */
  questionnaire?: OnlineQuestionnaireData;
  /** Revisão do Personal sobre uma avaliação enviada pelo Aluno. */
  review?: AssessmentReview;
}
