import { useEffect } from 'react';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useRetroWeeksStore } from '../store/useRetroWeeksStore';
import { useHistoricoStore } from '../store/useHistoricoStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useUIStore } from '../store/useUIStore';
import { useAuthStore } from '../store/useAuthStore';
import { salvarSemana } from '../lib/performanceRepository';
import { assinaturaSemana, montarSemanas, semanaVazia } from '../utils/performanceSync';
import type { SemanaDoc } from '../utils/performanceSync';

const DEBOUNCE_MS = 6000;
const CHUNK = 5;
const SIG_KEY = (email: string) => `jg3_perf_sync_sig:${email.toLowerCase()}`;

function lerAssinaturas(email: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(SIG_KEY(email));
    const o = raw ? (JSON.parse(raw) as unknown) : {};
    return o && typeof o === 'object' ? (o as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function gravarAssinaturas(email: string, sigs: Record<string, string>) {
  try {
    localStorage.setItem(SIG_KEY(email), JSON.stringify(sigs));
  } catch {
    /* sem storage: só perde o cache e regrava no próximo envio */
  }
}

/**
 * Só no app do ALUNO logado: publica a Performance dele (semana atual, retroativas e arquivadas) para o
 * Personal dono ver no perfil. Regrava apenas o que mudou (assinaturas guardadas no aparelho). No app do
 * Personal não faz nada. Falha de rede/Rules é silenciosa e tenta de novo na próxima mudança.
 */
export function usePerformanceSync(): void {
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const email = useAuthStore((s) => s.user?.email ?? '');

  useEffect(() => {
    if (!isAlunoMode || !email) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;
    let enviando = false;
    let repetir = false;

    const enviar = async () => {
      if (enviando) {
        repetir = true;
        return;
      }
      enviando = true;
      try {
        const w = useWorkoutStore.getState();
        const semanas = montarSemanas({
          weekLog: w.weekLog,
          weekPSE: w.weekPSE,
          exDone: w.exDone,
          retro: useRetroWeeksStore.getState().weeks,
          historico: useHistoricoStore.getState().semanas,
          exercises: useExerciseStore.getState().exercises,
        });
        const sigs = lerAssinaturas(email);
        const pendentes: SemanaDoc[] = [];
        for (const d of Object.values(semanas)) if (sigs[d.semana] !== assinaturaSemana(d)) pendentes.push(d);
        // Semana que já foi publicada e agora ficou vazia: publica vazia (não apaga nada).
        for (const k of Object.keys(sigs)) {
          if (!semanas[k]) {
            const v = semanaVazia(k);
            if (sigs[k] !== assinaturaSemana(v)) pendentes.push(v);
          }
        }
        for (let i = 0; i < pendentes.length && !cancelado; i += CHUNK) {
          const lote = pendentes.slice(i, i + CHUNK);
          const res = await Promise.allSettled(lote.map((d) => salvarSemana(email, d)));
          res.forEach((r, j) => {
            if (r.status === 'fulfilled') sigs[lote[j].semana] = assinaturaSemana(lote[j]);
            else console.warn('usePerformanceSync: falha ao enviar semana', lote[j].semana, r.reason);
          });
          gravarAssinaturas(email, sigs);
        }
      } finally {
        enviando = false;
        if (repetir && !cancelado) {
          repetir = false;
          agendar();
        }
      }
    };
    const agendar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void enviar(), DEBOUNCE_MS);
    };

    agendar();
    const unsubs = [
      useWorkoutStore.subscribe(agendar),
      useRetroWeeksStore.subscribe(agendar),
      useHistoricoStore.subscribe(agendar),
      useExerciseStore.subscribe(agendar),
    ];
    return () => {
      cancelado = true;
      clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, [isAlunoMode, email]);
}
