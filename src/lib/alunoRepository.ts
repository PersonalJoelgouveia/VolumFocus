import { db, doc, getDoc, setDoc } from './firebase';
import type { Aluno, AlunoRotina } from '../types/aluno';

/**
 * Camada repository para o domínio "Clientes" — sucessora de
 * syncClientToCloud() / salvarTreinoGoogleCloud() / cli_tentarCarregarRotinaPublicada()
 * (index.html ~10323-10340, ~11158-11173, ~11191-11210).
 *
 * Mesmo documento/coleção do monolito — `alunos/{email}` no Firestore —
 * para que o app React e o legado leiam/gravem o mesmo dado durante a
 * transição. Escrita continua restrita a PT_EMAILS pelas regras do
 * Firestore já publicadas (não replicadas aqui no client).
 */

function alunoDocRef(email: string) {
  return doc(db, 'alunos', email.toLowerCase());
}

/** Grava o perfil do aluno (dados cadastrais) na nuvem. Equivale a syncClientToCloud(). */
export async function syncAlunoPerfilToCloud(aluno: Aluno): Promise<boolean> {
  if (!aluno.email || !aluno.email.includes('@')) {
    console.error('syncAlunoPerfilToCloud: e-mail do aluno inválido');
    return false;
  }
  try {
    await setDoc(
      alunoDocRef(aluno.email),
      {
        email: aluno.email.toLowerCase(),
        perfilAluno: aluno,
        perfilAtualizadoEm: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.error('syncAlunoPerfilToCloud: falha ao gravar no Firestore', e);
    return false;
  }
}

/** Publica a rotina (Save & Publish do editor). Equivale a salvarTreinoGoogleCloud(). */
export async function syncRotinaToCloud(email: string, rotina: AlunoRotina): Promise<boolean> {
  if (!email || !email.includes('@')) {
    console.error('syncRotinaToCloud: e-mail do aluno inválido');
    return false;
  }
  try {
    await setDoc(
      alunoDocRef(email),
      {
        email: email.toLowerCase(),
        atualizadoEm: new Date().toISOString(),
        rotina,
      },
      { merge: true }
    );
    return true;
  } catch (e) {
    console.error('syncRotinaToCloud: falha ao gravar no Firestore', e);
    return false;
  }
}

export interface RotinaPublicada {
  rotina: AlunoRotina;
  /** ISO string de quando o Personal publicou por último — `atualizadoEm` gravado por syncRotinaToCloud(). */
  atualizadoEm: string | null;
}

/**
 * Busca a rotina publicada para um e-mail (lado do aluno). Equivale a
 * cli_tentarCarregarRotinaPublicada() (index.html ~11191-11210), sem a
 * conversão para weekLog — o aluno só visualiza o que o Personal
 * publicou, não registra execução em cima dele (schema livre, sem
 * vínculo com o banco de exercícios).
 *
 * Ao contrário de syncRotinaToCloud/syncAlunoPerfilToCloud, aqui o erro é
 * relançado (não silenciado) para a view distinguir "ainda sem rotina
 * publicada" (retorno null) de "falha ao consultar" (exceção) e mostrar
 * o estado certo.
 */
export async function fetchPublishedRotina(email: string): Promise<RotinaPublicada | null> {
  if (!email || !email.includes('@')) return null;
  const snap = await getDoc(alunoDocRef(email));
  if (!snap.exists()) return null;
  const data = snap.data();
  const rotina = data.rotina as AlunoRotina | undefined;
  if (!rotina) return null;
  return { rotina, atualizadoEm: (data.atualizadoEm as string | undefined) ?? null };
}
