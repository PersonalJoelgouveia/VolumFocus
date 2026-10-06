import { collection, db, doc, getDoc, getDocs, orderBy, query, writeBatch } from './firebase';
import { criarRotinaVazia } from '../types/aluno';
import type { AlunoExercicio, AlunoRotina, AlunoRotinaSalva } from '../types/aluno';
import { DAYS_SHORT } from '../types/workout';
import { ordenarRotinasAluno } from '../utils/ordenarRotinasAluno';

/**
 * Repository das rotinas do aluno (várias por aluno) — subcoleção
 * `alunos/{email}/rotinas/{id}`, mesmo padrão de physicalAssessmentRepository.ts.
 *
 * Convive com `alunos/{email}.rotina` (rotina publicada única, ainda lida por
 * alunoRepository.ts/useSyncStore): este módulo NÃO toca nesse campo.
 *
 * Invariante: no máximo UMA rotina com `ativa === true` por aluno. Toda
 * escrita que ativa uma rotina desativa as demais NO MESMO writeBatch
 * (atômico — nunca existem duas ativas, nem zero no meio da troca).
 *
 * Erros não são silenciados (quem chama decide o feedback ao usuário).
 * A leitura desconfia do conteúdo: usa o id do DOCUMENTO e ignora (com
 * aviso) documentos malformados em vez de quebrar a tela.
 */

function rotinasCol(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'rotinas');
}

function rotinaDocRef(email: string, rotinaId: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'rotinas', rotinaId);
}

/** O Firestore recusa `undefined` e `NaN`; o round-trip JSON os remove/normaliza. */
function semUndefined<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

/**
 * As regras só garantem "lista de 7"; o conteúdo dos dias não é validado no servidor.
 * Normaliza para SEMPRE 7 dias com `exercicios` array de objetos com `nome` — um documento
 * malformado não pode derrubar a tela do aluno (resumo/lista assumem esse formato).
 */
function normalizarRotina(bruta: unknown[]): AlunoRotina {
  return DAYS_SHORT.map((_, i) => {
    const dia = bruta[i] && typeof bruta[i] === 'object' ? (bruta[i] as Record<string, unknown>) : {};
    const exercicios = Array.isArray(dia.exercicios)
      ? (dia.exercicios.filter(
          (e) => e && typeof e === 'object' && typeof (e as { nome?: unknown }).nome === 'string'
        ) as AlunoExercicio[])
      : [];
    return { tipo: typeof dia.tipo === 'string' && dia.tipo ? dia.tipo : 'Descanso Total', exercicios };
  });
}

function validarRotinaRemota(data: unknown, docId: string): AlunoRotinaSalva | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.nome !== 'string' || !Array.isArray(d.rotina)) return null;
  if (typeof d.ativa !== 'boolean') return null;
  return {
    id: docId,
    nome: d.nome,
    rotina: normalizarRotina(d.rotina),
    ativa: d.ativa,
    criadaEm: typeof d.criadaEm === 'string' ? d.criadaEm : '',
    atualizadaEm: typeof d.atualizadaEm === 'string' ? d.atualizadaEm : '',
    personalEmail: typeof d.personalEmail === 'string' ? d.personalEmail : '',
  };
}

export interface CriarRotinaInput {
  nome: string;
  personalEmail: string;
  /** Padrão: rotina vazia (7 dias de "Descanso Total"). */
  rotina?: AlunoRotina;
  /** Padrão: false. Se true, desativa a rotina ativa anterior atomicamente. */
  ativa?: boolean;
}

/** Lista as rotinas do aluno, mais recente primeiro. Malformadas são ignoradas. */
export async function listarRotinasAluno(
  studentEmail: string,
  onInvalid?: (ids: string[]) => void
): Promise<AlunoRotinaSalva[]> {
  const snap = await getDocs(query(rotinasCol(studentEmail), orderBy('criadaEm', 'desc')));
  const validas: AlunoRotinaSalva[] = [];
  const invalidas: string[] = [];
  for (const d of snap.docs) {
    const r = validarRotinaRemota(d.data(), d.id);
    if (r) validas.push(r);
    else invalidas.push(d.id);
  }
  if (invalidas.length > 0) {
    console.warn('alunoRotinasRepository: rotinas inválidas ignoradas', invalidas);
    onInvalid?.(invalidas);
  }
  return validas;
}

/** Busca uma rotina específica. `null` se não existir ou for malformada. */
export async function obterRotinaAluno(studentEmail: string, rotinaId: string): Promise<AlunoRotinaSalva | null> {
  const snap = await getDoc(rotinaDocRef(studentEmail, rotinaId));
  return snap.exists() ? validarRotinaRemota(snap.data(), snap.id) : null;
}

/** Rotina ativa do aluno, ou `null` se nenhuma estiver ativa. */
export async function obterRotinaAtiva(studentEmail: string): Promise<AlunoRotinaSalva | null> {
  const todas = ordenarRotinasAluno(await listarRotinasAluno(studentEmail));
  return todas.find((r) => r.ativa) ?? null; // mesma regra da lista: a ativa mais recente
}

/**
 * Cria uma rotina para o aluno e devolve o documento gravado. Com `ativa: true`,
 * as outras rotinas ativas são desativadas no mesmo batch.
 */
export async function criarRotinaAluno(studentEmail: string, input: CriarRotinaInput): Promise<AlunoRotinaSalva> {
  const nome = input.nome.trim();
  if (!nome) throw new Error('criarRotinaAluno: nome da rotina é obrigatório');
  if (!input.personalEmail.includes('@')) throw new Error('criarRotinaAluno: e-mail do Personal inválido');

  const agora = new Date().toISOString();
  const ref = doc(rotinasCol(studentEmail)); // id gerado no cliente
  const nova: AlunoRotinaSalva = {
    id: ref.id,
    nome,
    rotina: input.rotina ?? criarRotinaVazia(),
    ativa: input.ativa === true,
    criadaEm: agora,
    atualizadaEm: agora,
    personalEmail: input.personalEmail.toLowerCase(),
  };

  const batch = writeBatch(db);
  if (nova.ativa) await desativarOutras(batch, studentEmail, nova.id, agora);
  batch.set(ref, semUndefined(nova));
  await batch.commit();
  return nova;
}

/**
 * Torna `rotinaId` a única rotina ativa, desativando a(s) anterior(es) no mesmo
 * batch. Lança se a rotina não existir (nada é alterado).
 */
export async function definirRotinaAtiva(studentEmail: string, rotinaId: string): Promise<void> {
  const alvo = await getDoc(rotinaDocRef(studentEmail, rotinaId));
  if (!alvo.exists()) throw new Error(`definirRotinaAtiva: rotina "${rotinaId}" não encontrada`);

  const agora = new Date().toISOString();
  const batch = writeBatch(db);
  await desativarOutras(batch, studentEmail, rotinaId, agora);
  batch.update(rotinaDocRef(studentEmail, rotinaId), { ativa: true, atualizadaEm: agora });
  await batch.commit();
}

/** Enfileira no batch a desativação de toda rotina ativa diferente de `exceptoId`. */
async function desativarOutras(
  batch: ReturnType<typeof writeBatch>,
  studentEmail: string,
  exceptoId: string,
  agora: string
): Promise<void> {
  const snap = await getDocs(rotinasCol(studentEmail));
  for (const d of snap.docs) {
    if (d.id !== exceptoId && d.data().ativa === true) {
      batch.update(d.ref, { ativa: false, atualizadaEm: agora });
    }
  }
}
