import { syncRotinaToCloud } from './alunoRepository';
import { criarRotinaAluno, obterRotinaAtiva } from './alunoRotinasRepository';
import type { AlunoRotina } from '../types/aluno';

/**
 * "Salvar & Publicar" do Personal (Clientes → editor de rotina), em DUAS escritas:
 *
 *  1. Modelo novo (fonte de verdade): cria uma rotina em `alunos/{email}/rotinas` e a torna a
 *     ativa (a anterior vira inativa e continua no histórico). Se a ativa já tem EXATAMENTE o
 *     mesmo conteúdo, não cria outra (publicar duas vezes sem mudar nada não polui o histórico).
 *  2. Legado: `alunos/{email}.rotina` (compatibilidade com alunos/versões que ainda leem o campo).
 *
 * Sem (1), um aluno que já tem rotinas no modelo novo ignoraria a publicação (o legado só é
 * lido quando ele não tem rotinas — ver lib/rotinaAtivaAluno). As duas escritas são tentadas
 * sempre; o resultado diz qual deu certo para a UI avisar com precisão.
 */
export interface ResultadoPublicacao {
  multiplas: boolean;
  legado: boolean;
}

/** JSON com chaves ordenadas — o Firestore devolve os mapas em outra ordem de chaves. */
function chaveEstavel(valor: unknown): string {
  return JSON.stringify(valor, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v
  );
}

function nomeAutomatico(): string {
  return `Publicada em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`;
}

export async function publicarRotinaParaAluno(
  studentEmail: string,
  rotina: AlunoRotina,
  personalEmail: string
): Promise<ResultadoPublicacao> {
  let multiplas = false;
  try {
    const ativa = await obterRotinaAtiva(studentEmail);
    if (ativa && chaveEstavel(ativa.rotina) === chaveEstavel(JSON.parse(JSON.stringify(rotina)))) {
      multiplas = true; // já é a ativa, idêntica: nada a criar
    } else {
      await criarRotinaAluno(studentEmail, { nome: nomeAutomatico(), personalEmail, rotina, ativa: true });
      multiplas = true;
    }
  } catch (e) {
    console.error('publicarRotinaParaAluno: falha ao gravar no modelo de múltiplas rotinas', e);
  }
  const legado = await syncRotinaToCloud(studentEmail, rotina);
  return { multiplas, legado };
}
