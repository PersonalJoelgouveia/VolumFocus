import { OWNER_KEY, getLocalAuthUid } from './localOwner';
import { useAlunoStore } from '../store/useAlunoStore';
import type { PhysicalAssessment } from '../types/assessment';
import type { TrainingNote } from '../types/trainingNote';

/**
 * MIGRAÇÃO sem perda: avaliações e anotações deixaram de ser persistidas em disco (eram cache do Firestore).
 * Antes de o formato antigo (`jg3_alunos` com `avaliacoes`/`notas`) ser regravado, o conteúdo sensível é
 * COPIADO para uma chave de quarentena. Ela só é apagada depois de cada item ser conferido na nuvem
 * (ou enviado, no caso de anotações mais novas que a da nuvem). Itens que não puderem ser confirmados
 * ficam na quarentena e são contados — nada é apagado por suposição.
 *
 * Proveniência: só reconcilia se o dono gravado na quarentena for a conta autenticada agora. Sem dono
 * (origem não comprovada) NÃO envia nada à nuvem — o usuário decide (apagar dados locais no logout).
 */
export const QUARENTENA_KEY = 'jg3_legado_sensivel_v1';

interface Quarentena {
  v: 1;
  /** uid dono do aparelho quando o legado foi guardado (null = sem dono registrado: origem não comprovada). */
  ownerUid: string | null;
  notas: Record<string, TrainingNote[]>;
  avaliacoes: Record<string, PhysicalAssessment[]>;
}

function temItens(r: Record<string, unknown[]> | undefined): boolean {
  return !!r && Object.values(r).some((l) => Array.isArray(l) && l.length > 0);
}

/** Chamado pelo `migrate` do persist (v<2). Só copia; nunca apaga. */
export function guardarLegadoSensivel(persisted: unknown): void {
  try {
    const p = (persisted ?? {}) as { notas?: Record<string, TrainingNote[]>; avaliacoes?: Record<string, PhysicalAssessment[]> };
    if (!temItens(p.notas) && !temItens(p.avaliacoes)) return;
    if (localStorage.getItem(QUARENTENA_KEY)) return; // já guardado: não sobrescreve
    const q: Quarentena = { v: 1, ownerUid: localStorage.getItem(OWNER_KEY), notas: p.notas ?? {}, avaliacoes: p.avaliacoes ?? {} };
    localStorage.setItem(QUARENTENA_KEY, JSON.stringify(q));
  } catch (e) {
    console.error('migracaoSensivel: não foi possível guardar o legado', e);
  }
}

export function temLegadoSensivel(): boolean {
  try {
    return !!localStorage.getItem(QUARENTENA_KEY);
  } catch {
    return false;
  }
}

export interface ResultadoMigracao {
  status: 'nada' | 'origem-nao-comprovada' | 'concluida' | 'pendencias';
  confirmados: number;
  enviados: number;
  pendentes: number;
}

/** Roda online, depois do login autorizado. Idempotente. */
export async function reconciliarLegadoSensivel(): Promise<ResultadoMigracao> {
  const vazio: ResultadoMigracao = { status: 'nada', confirmados: 0, enviados: 0, pendentes: 0 };
  let q: Quarentena;
  try {
    const raw = localStorage.getItem(QUARENTENA_KEY);
    if (!raw) return vazio;
    q = JSON.parse(raw) as Quarentena;
  } catch {
    return vazio;
  }
  // Import dinâmico: este módulo é carregado pelo useAlunoStore; importar os repositórios (Firebase) aqui
  // criaria dependência de Firebase em tudo que usa o store.
  const [{ createNote, getNote, updateNote }, { getAssessment }] = await Promise.all([
    import('./trainingNotesRepository'),
    import('./physicalAssessmentRepository'),
  ]);
  const uid = getLocalAuthUid();
  if (!uid || q.ownerUid !== uid) return { ...vazio, status: 'origem-nao-comprovada' };

  const emailDe = (alunoId: string) => useAlunoStore.getState().alunos.find((a) => a.id === alunoId)?.email;
  let confirmados = 0;
  let enviados = 0;
  let pendentes = 0;
  const restoNotas: Record<string, TrainingNote[]> = {};
  const restoAval: Record<string, PhysicalAssessment[]> = {};

  for (const [alunoId, notas] of Object.entries(q.notas)) {
    const email = emailDe(alunoId);
    for (const n of notas) {
      try {
        if (!email) throw new Error('aluno não encontrado');
        const nuvem = await getNote(email, n.id);
        if (!nuvem) {
          await createNote(email, n);
          enviados++;
        } else if (String(n.updatedAt ?? '') > String(nuvem.updatedAt ?? '')) {
          await updateNote(email, n.id, { conteudo: n.conteudo, updatedAt: n.updatedAt });
          enviados++;
        } else confirmados++;
      } catch {
        pendentes++;
        (restoNotas[alunoId] ??= []).push(n);
      }
    }
  }
  for (const [alunoId, avals] of Object.entries(q.avaliacoes)) {
    const email = emailDe(alunoId);
    for (const a of avals) {
      try {
        if (!email) throw new Error('aluno não encontrado');
        if (await getAssessment(email, a.id)) confirmados++;
        else throw new Error('ausente na nuvem');
      } catch {
        pendentes++;
        (restoAval[alunoId] ??= []).push(a);
      }
    }
  }

  try {
    if (pendentes === 0) {
      localStorage.removeItem(QUARENTENA_KEY);
      // regrava jg3_alunos já no formato novo (só `alunos`), removendo o conteúdo sensível do disco
      useAlunoStore.setState({});
    } else {
      localStorage.setItem(QUARENTENA_KEY, JSON.stringify({ ...q, notas: restoNotas, avaliacoes: restoAval }));
    }
  } catch (e) {
    console.error('migracaoSensivel: falha ao atualizar a quarentena', e);
  }
  return { status: pendentes === 0 ? 'concluida' : 'pendencias', confirmados, enviados, pendentes };
}
