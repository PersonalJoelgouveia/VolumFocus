import { collection, db, doc, getDocs, limit, orderBy, query, setDoc } from './firebase';
import { validarResumoRemoto } from '../utils/cardioSemanalAluno';
import type { ResumoCardioSemanal } from '../utils/cardioSemanalAluno';

/**
 * Resumo semanal de cardio por aluno: `alunos/{email}/cardioSemanal/{AAAA-MM-DD da segunda}`.
 * Quem GRAVA é o próprio aluno (Rules: ehDono + consentOk); o Personal dono só LÊ.
 */
const col = (email: string) => collection(db, 'alunos', email.toLowerCase(), 'cardioSemanal');

export async function salvarResumoCardio(email: string, r: ResumoCardioSemanal): Promise<void> {
  await setDoc(doc(db, 'alunos', email.toLowerCase(), 'cardioSemanal', r.semana), JSON.parse(JSON.stringify(r)));
}

/** Últimas `n` semanas (mais recente primeiro); documentos malformados são ignorados. */
export async function listarResumosCardio(email: string, n = 6): Promise<ResumoCardioSemanal[]> {
  const snap = await getDocs(query(col(email), orderBy('semana', 'desc'), limit(n)));
  const out: ResumoCardioSemanal[] = [];
  for (const d of snap.docs) {
    const r = validarResumoRemoto(d.data(), d.id);
    if (r) out.push(r);
  }
  return out;
}
