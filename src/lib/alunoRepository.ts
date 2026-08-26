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

/** Busca a rotina publicada para um e-mail (lado do aluno). Equivale a
 *  cli_tentarCarregarRotinaPublicada(), sem a conversão para weekLog —
 *  essa parte fica para quando o login do aluno for migrado. */
export async function fetchRotinaFromCloud(email: string): Promise<AlunoRotina | null> {
  if (!email || !email.includes('@')) return null;
  try {
    const snap = await getDoc(alunoDocRef(email));
    if (!snap.exists()) return null;
    return (snap.data().rotina as AlunoRotina | undefined) ?? null;
  } catch (e) {
    console.error('fetchRotinaFromCloud: falha ao ler do Firestore', e);
    return null;
  }
}
