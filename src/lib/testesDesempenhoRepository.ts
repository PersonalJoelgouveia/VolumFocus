import { collection, db, deleteDoc, doc, getDocs, orderBy, query, setDoc } from './firebase';
import { validarTesteRemoto } from '../utils/testesDesempenho';
import type { TesteDesempenhoDoc } from '../utils/testesDesempenho';

/**
 * Testes de Força (1RM) e Cardiorrespiratórios POR ALUNO: `alunos/{email}/testesDesempenho/{id}`.
 * Quem escreve é só o Personal DONO do cliente (Rules: ptDoAluno + consentOk); o aluno só LÊ os
 * próprios. Dado de saúde ⇒ nunca persistido em localStorage (ver useTestesRemotosStore).
 * A leitura desconfia do conteúdo (validarTesteRemoto) — documento malformado é ignorado.
 */
function col(email: string) {
  return collection(db, 'alunos', email.toLowerCase(), 'testesDesempenho');
}
function ref(email: string, id: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'testesDesempenho', id);
}

/** O SDK recusa `undefined`; o round-trip JSON também troca NaN/Infinity por null (que as Rules recusam). */
const limpo = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function listTestes(email: string, onInvalid?: (ids: string[]) => void): Promise<TesteDesempenhoDoc[]> {
  const snap = await getDocs(query(col(email), orderBy('data', 'desc')));
  const ok: TesteDesempenhoDoc[] = [];
  const ruins: string[] = [];
  for (const d of snap.docs) {
    const t = validarTesteRemoto(d.data(), d.id);
    if (t) ok.push(t);
    else ruins.push(d.id);
  }
  if (ruins.length > 0) {
    console.warn('testesDesempenhoRepository: testes inválidos ignorados', ruins);
    onInvalid?.(ruins);
  }
  return ok;
}

export async function createTeste(email: string, teste: TesteDesempenhoDoc): Promise<void> {
  await setDoc(ref(email, teste.id), limpo(teste));
}

export async function deleteTeste(email: string, id: string): Promise<void> {
  await deleteDoc(ref(email, id));
}
