/**
 * Circunferências corporais — modelo de dados (estado de formulário),
 * validação e conversão para o formato persistido. Módulo puro: nenhuma
 * dependência de React.
 *
 * `CircumferenceEntry` aqui é o estado de UI (valor pode estar vazio
 * enquanto o usuário preenche); `CircumferenceEntry`/`CircumferenceMeasurement`
 * em `types/assessment.ts` é a forma persistida (valor sempre presente,
 * só medidas de fato tiradas). `Side`/`Unit` vêm de lá — única fonte pros
 * dois lados da borda formulário/domínio.
 */
import type { CircumferenceMeasurement, CircumferenceSide, CircumferenceUnit } from '../types/assessment';

export type { CircumferenceSide, CircumferenceUnit };

export interface CircumferenceEntry {
  id: string;
  nome: string;
  valor: number | undefined;
  unidade: CircumferenceUnit;
  lado: CircumferenceSide;
  personalizada?: boolean;
}

export interface CircumferenceValidationError {
  id: string;
  message: string;
}

/** Os 10 pontos padrão do protocolo, na ordem em que devem aparecer. */
export const STANDARD_CIRCUMFERENCES: Array<Pick<CircumferenceEntry, 'id' | 'nome' | 'lado'>> = [
  { id: 'bracoDireito', nome: 'Braço direito', lado: 'direito' },
  { id: 'bracoEsquerdo', nome: 'Braço esquerdo', lado: 'esquerdo' },
  { id: 'torax', nome: 'Tórax', lado: 'none' },
  { id: 'cintura', nome: 'Cintura', lado: 'none' },
  { id: 'abdomen', nome: 'Abdômen', lado: 'none' },
  { id: 'quadril', nome: 'Quadril', lado: 'none' },
  { id: 'coxaDireita', nome: 'Coxa direita', lado: 'direito' },
  { id: 'coxaEsquerda', nome: 'Coxa esquerda', lado: 'esquerdo' },
  { id: 'panturrilhaDireita', nome: 'Panturrilha direita', lado: 'direito' },
  { id: 'panturrilhaEsquerda', nome: 'Panturrilha esquerda', lado: 'esquerdo' },
];

/** Lista inicial com os 10 pontos padrão, todos sem valor ainda. */
export function criarCircunferenciasPadrao(): CircumferenceEntry[] {
  return STANDARD_CIRCUMFERENCES.map((site) => ({
    id: site.id,
    nome: site.nome,
    lado: site.lado,
    valor: undefined,
    unidade: 'cm',
    personalizada: false,
  }));
}

/** Nova medida personalizada vazia, pronta para o usuário nomear. */
export function criarCircunferenciaPersonalizada(): CircumferenceEntry {
  return {
    id: `circ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: '',
    valor: undefined,
    unidade: 'cm',
    lado: 'none',
    personalizada: true,
  };
}

/**
 * Validação: nome obrigatório (inclusive personalizadas), sem nomes
 * duplicados, valor (quando preenchido) não pode ser negativo nem
 * implausível. Medida sem valor não é erro — nem toda medida é tirada em
 * toda sessão.
 */
export function validarCircunferencias(entries: CircumferenceEntry[]): CircumferenceValidationError[] {
  const erros: CircumferenceValidationError[] = [];
  const primeiroIdPorNome = new Map<string, string>();

  for (const entry of entries) {
    const nome = entry.nome.trim();
    if (!nome) {
      erros.push({ id: entry.id, message: 'Informe o nome da medida.' });
    } else {
      const chave = nome.toLowerCase();
      const primeiroId = primeiroIdPorNome.get(chave);
      if (primeiroId && primeiroId !== entry.id) {
        erros.push({ id: entry.id, message: 'Já existe uma medida com esse nome.' });
      } else {
        primeiroIdPorNome.set(chave, entry.id);
      }
    }

    if (entry.valor != null) {
      if (Number.isNaN(entry.valor)) {
        erros.push({ id: entry.id, message: 'Valor inválido.' });
      } else if (entry.valor < 0) {
        erros.push({ id: entry.id, message: 'Valor não pode ser negativo.' });
      } else if (entry.valor > 300) {
        erros.push({ id: entry.id, message: 'Valor fora da faixa plausível (máx. 300cm).' });
      }
    }
  }

  return erros;
}

/**
 * Converte o estado de formulário para `CircumferenceMeasurement`
 * (types/assessment.ts) — só medidas com valor preenchido entram; cada
 * uma carrega nome/unidade/lado, pronta pra série histórica/gráfico.
 */
export function paraRegistroHistorico(entries: CircumferenceEntry[]): CircumferenceMeasurement {
  return entries
    .filter((e) => e.valor != null && !Number.isNaN(e.valor))
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      valor: e.valor as number,
      unidade: e.unidade,
      lado: e.lado,
      personalizada: e.personalizada,
    }));
}
