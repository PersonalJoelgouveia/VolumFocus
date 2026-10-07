import { useEffect } from 'react';
import { auth } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { useSessionStore } from '../store/useSessionStore';
import { useAlunoStore } from '../store/useAlunoStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useSyncStore } from '../store/useSyncStore';
import { setCargaEditadaListener, useWorkoutStore } from '../store/useWorkoutStore';
import {
  chavesPendentes,
  descarregarCargasPendentes,
  lerCargasCompartilhadas,
  registrarCargaEditada,
} from '../lib/cargasCompartilhadas';
import { aplicarCargasNaRotina, aplicarCargasNoWeekLog } from '../utils/cargasCompartilhadas';
import type { PapelCarga } from '../utils/cargasCompartilhadas';

const INTERVALO_MS = 30_000;

/** Quem sou eu e de quem é a semana na tela: aluno (ele mesmo) ou Personal numa sessão de aluno. */
function contextoAtual(): { email: string; papel: PapelCarga; alunoId?: string } | null {
  const { role } = useAuthStore.getState();
  if (role === 'personal') {
    const { activeSessionId, sessions } = useSessionStore.getState();
    const sess = activeSessionId ? sessions.find((x) => x.id === activeSessionId) : undefined;
    const aluno = sess ? useAlunoStore.getState().alunos.find((a) => a.id === sess.alunoId) : undefined;
    return aluno?.email ? { email: aluno.email.toLowerCase(), papel: 'personal', alunoId: aluno.id } : null;
  }
  const email = auth.currentUser?.email?.toLowerCase();
  if (role === 'aluno' && useUIStore.getState().isAlunoMode && email) return { email, papel: 'aluno' };
  return null;
}

/** Puxa as cargas gravadas pelo outro lado e aplica na semana em tela (e no rascunho do Personal). */
export async function sincronizarCargasAgora(): Promise<number> {
  const ctx = contextoAtual();
  if (!ctx) return 0;
  const cargas = await lerCargasCompartilhadas(ctx.email);
  // Contexto pode ter mudado durante a leitura (troca de aba/sessão): descarta.
  const depois = contextoAtual();
  if (!depois || depois.email !== ctx.email) return 0;

  const w = useWorkoutStore.getState();
  const { weekLog, alterados } = aplicarCargasNoWeekLog(
    w.weekLog,
    useExerciseStore.getState().exercises,
    w.exDone,
    cargas,
    ctx.papel,
    chavesPendentes(ctx.email)
  );
  if (alterados) {
    // Em sessão de aluno o dado não vai para o backup pessoal do Personal (mesma regra do swap de abas).
    const sync = useSyncStore.getState();
    const pausar = ctx.papel === 'personal';
    if (pausar) sync.pauseWatchers();
    try {
      useWorkoutStore.setState({ weekLog });
    } finally {
      if (pausar) sync.resumeWatchers();
    }
  }

  if (ctx.papel === 'personal' && ctx.alunoId) {
    const store = useAlunoStore.getState();
    const aluno = store.alunos.find((a) => a.id === ctx.alunoId);
    if (aluno) {
      const r = aplicarCargasNaRotina(aluno.rotina, cargas, 'personal');
      r.diasAlterados.forEach((d) => store.setRotinaDia(aluno.id, d, r.rotina[d]));
    }
  }
  return alterados;
}

/**
 * Mantém o peso dos exercícios em sincronia entre aluno e Personal (sessão do aluno):
 *  - edição de peso aqui → grava em alunos/{email}/cargas/atuais (debounce);
 *  - a cada 30 s, ao voltar para a aba e ao trocar de sessão → lê e aplica o que o outro lado mudou.
 * Montado uma vez em RegistroView (onde o peso é editado).
 */
export function useCargasCompartilhadasSync(): void {
  const role = useAuthStore((s) => s.role);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);

  useEffect(() => {
    setCargaEditadaListener((exId, carga) => {
      const ctx = contextoAtual();
      if (!ctx) return;
      const nome = useExerciseStore.getState().exercises.find((x) => x.id === exId)?.name;
      if (nome) registrarCargaEditada(ctx.email, nome, carga, ctx.papel);
    });
    return () => setCargaEditadaListener(null);
  }, []);

  useEffect(() => {
    if (role !== 'personal' && role !== 'aluno') return;
    const rodar = () => {
      if (document.visibilityState === 'hidden') return;
      void sincronizarCargasAgora().catch((e) => console.error('useCargasCompartilhadasSync: falha ao sincronizar', e));
    };
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'hidden') void descarregarCargasPendentes();
      else rodar();
    };
    rodar();
    const id = setInterval(rodar, INTERVALO_MS);
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
      void descarregarCargasPendentes();
    };
  }, [role, activeSessionId]);
}
