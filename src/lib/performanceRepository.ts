import { collection, db, doc, getDocs, limit, orderBy, query, setDoc } from './firebase';
import { validarSemanaRemota } from '../utils/performanceSync';
import type { SemanaDoc } from '../utils/performanceSync';

/**
 * Performance por aluno: `alunos/{email}/performanceSemanas/{AAAA-MM-DD da segunda}`.
 * Quem GRAVA é o próprio aluno (Rules: ehDono + cadastrado + consentOk); o Personal dono só LÊ.
 */
const col = (email: string) => collection(db, 'alunos', email.toLowerCase(), 'performanceSemanas');

export async function salvarSemana(email: string, d: SemanaDoc): Promise<void> {
  await setDoc(doc(db, 'alunos', email.toLowerCase(), 'performanceSemanas', d.semana), JSON.parse(JSON.stringify(d)));
}

/** Últimas `n` semanas (mais recente primeiro); documentos malformados são ignorados. */
export async function listarSemanas(email: string, n = 120): Promise<SemanaDoc[]> {
  const snap = await getDocs(query(col(email), orderBy('semana', 'desc'), limit(n)));
  const out: SemanaDoc[] = [];
  for (const s of snap.docs) {
    const d = validarSemanaRemota(s.data(), s.id);
    if (d) out.push(d);
  }
  return out;
}
