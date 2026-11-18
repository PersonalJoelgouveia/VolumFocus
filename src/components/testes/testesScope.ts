import { createContext, useContext, useEffect, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useCardioTestStore } from '../../store/useCardioTestStore';
import { useStrengthStore } from '../../store/useStrengthStore';
import type { StrHistoryEntry } from '../../store/useStrengthStore';
import { useTestesRemotosStore } from '../../store/useTestesRemotosStore';
import { useUIStore } from '../../store/useUIStore';
import type { CardioTestResult } from '../../types/cardioTest';
import type { StrFormulaKey, StrRecord } from '../../types/strength';
import { exigirOnline } from '../../lib/connectivity';
import {
  derivarCardio,
  derivarForca,
  unirHistoricoForca,
  unirRecordes,
} from '../../utils/testesDesempenho';
import type { TesteCardioDoc, TesteForcaDoc } from '../../utils/testesDesempenho';
import { parseDataPtBr } from '../../utils/testesComparativo';

/**
 * ESCOPO dos testes de Força/Cardio. Os componentes de teste (cálculo, recordes, histórico,
 * dashboard) não leem mais o store direto: pedem ao escopo. Sem provider = os testes do PRÓPRIO
 * usuário logado (comportamento de sempre, localStorage). Com provider:
 *  - Personal vendo um aluno: lê e grava SÓ os testes desse aluno (Firestore, alunos/{email}/testesDesempenho);
 *  - Aluno: vê os testes registrados pelo Personal + os seus; novos testes dele continuam locais.
 */
export interface StrengthScope {
  records: Record<string, StrRecord>;
  history: StrHistoryEntry[];
  /** true se foi um novo recorde (mesma regra do store local). */
  upsertRecord: (exerciseName: string, weight: number, reps: number, oneRM: number, formula: StrFormulaKey, rir: number) => boolean;
}
export interface CardioScope {
  testes: CardioTestResult[];
  salvar: (t: CardioTestResult) => void;
  remover: (id: string) => void;
  canRemove: (id: string) => boolean;
}
export interface TestesScopeValue {
  strength: StrengthScope;
  cardio: CardioScope;
  loading: boolean;
  error: boolean;
  /** Dados do cadastro do aluno, só para pré-preencher formulários (nunca sobrescrevem o que for digitado). */
  perfil?: { gender?: 'M' | 'F'; age?: number };
}

export const TestesScopeContext = createContext<TestesScopeValue | null>(null);

export function useStrengthScope(): StrengthScope {
  const records = useStrengthStore((s) => s.records);
  const history = useStrengthStore((s) => s.history);
  const upsertRecord = useStrengthStore((s) => s.upsertRecord);
  const ctx = useContext(TestesScopeContext);
  return ctx?.strength ?? { records, history, upsertRecord };
}

export function useCardioScope(): CardioScope {
  const testes = useCardioTestStore((s) => s.testes);
  const salvar = useCardioTestStore((s) => s.salvar);
  const remover = useCardioTestStore((s) => s.remover);
  const ctx = useContext(TestesScopeContext);
  return ctx?.cardio ?? { testes, salvar, remover, canRemove: () => true };
}

export function useTestesScopePerfil(): TestesScopeValue['perfil'] {
  return useContext(TestesScopeContext)?.perfil;
}

export function useTestesScopeStatus(): { loading: boolean; error: boolean } {
  const ctx = useContext(TestesScopeContext);
  return { loading: ctx?.loading ?? false, error: ctx?.error ?? false };
}

const novoId = () => `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Personal vendo/registrando os testes de UM aluno (nuvem). Só ele. */
export function usePersonalAlunoScope(alunoEmail: string): TestesScopeValue {
  const emailLogado = useAuthStore((s) => s.user?.email);
  const entrada = useTestesRemotosStore((s) => s.byEmail[alunoEmail.toLowerCase()]);
  const carregar = useTestesRemotosStore((s) => s.carregar);
  const adicionar = useTestesRemotosStore((s) => s.adicionar);
  const remover = useTestesRemotosStore((s) => s.remover);
  const showToast = useUIStore((s) => s.showToast);

  useEffect(() => {
    void carregar(alunoEmail);
  }, [alunoEmail, carregar]);

  const docs = entrada?.docs;
  const forca = useMemo(() => derivarForca((docs ?? []).filter((d): d is TesteForcaDoc => d.tipo === 'forca')), [docs]);
  const cardio = useMemo(() => derivarCardio((docs ?? []).filter((d): d is TesteCardioDoc => d.tipo === 'cardio')), [docs]);
  const autor = (emailLogado ?? '').toLowerCase();

  return useMemo<TestesScopeValue>(
    () => ({
      loading: entrada?.status === 'loading' && !docs?.length,
      error: entrada?.status === 'error',
      strength: {
        records: forca.records,
        history: forca.history,
        upsertRecord: (exercise, weight, reps, oneRM, formula, rir) => {
          const existente = forca.records[exercise];
          if (existente && oneRM <= existente.oneRM) return false;
          if (!exigirOnline('salvar o teste de força')) return false;
          const doc: TesteForcaDoc = { id: novoId(), tipo: 'forca', data: new Date().toISOString(), exercise, weight, reps, rir: rir || 0, oneRM, formula: formula || 'hibrida', autorEmail: autor };
          void adicionar(alunoEmail, doc).then((ok) => {
            if (!ok) showToast('Não foi possível salvar o teste na nuvem. Tente novamente.', 'error');
          });
          return true;
        },
      },
      cardio: {
        testes: cardio,
        salvar: (t) => {
          if (!exigirOnline('salvar o teste cardiorrespiratório')) return;
          const doc: TesteCardioDoc = { id: t.id, tipo: 'cardio', data: t.data, resultado: t, autorEmail: autor };
          void adicionar(alunoEmail, doc).then((ok) => {
            if (!ok) showToast('Não foi possível salvar o teste na nuvem. Tente novamente.', 'error');
          });
        },
        remover: (id) => {
          if (!exigirOnline('remover o teste')) return;
          void remover(alunoEmail, id).then((ok) => {
            if (!ok) showToast('Não foi possível remover o teste. Tente novamente.', 'error');
          });
        },
        canRemove: () => true,
      },
    }),
    [entrada?.status, docs, forca, cardio, alunoEmail, autor, adicionar, remover, showToast],
  );
}

/**
 * Aluno logado: testes registrados pelo Personal (nuvem, só leitura) + os próprios (locais).
 * Novos testes do aluno continuam indo para o aparelho dele; os do Personal não podem ser apagados por ele.
 */
export function useAlunoMeusTestesScope(): TestesScopeValue {
  const email = useAuthStore((s) => s.user?.email)?.toLowerCase() ?? '';
  const entrada = useTestesRemotosStore((s) => s.byEmail[email]);
  const carregar = useTestesRemotosStore((s) => s.carregar);
  const localRecords = useStrengthStore((s) => s.records);
  const localHistory = useStrengthStore((s) => s.history);
  const upsertLocal = useStrengthStore((s) => s.upsertRecord);
  const localCardio = useCardioTestStore((s) => s.testes);
  const salvarLocal = useCardioTestStore((s) => s.salvar);
  const removerLocal = useCardioTestStore((s) => s.remover);

  useEffect(() => {
    if (email) void carregar(email);
  }, [email, carregar]);

  const docs = entrada?.docs;
  const forca = useMemo(() => derivarForca((docs ?? []).filter((d): d is TesteForcaDoc => d.tipo === 'forca')), [docs]);
  const cardioRemoto = useMemo(() => derivarCardio((docs ?? []).filter((d): d is TesteCardioDoc => d.tipo === 'cardio')), [docs]);

  return useMemo<TestesScopeValue>(() => {
    const idsRemotos = new Set(cardioRemoto.map((t) => t.id));
    const todos = [...cardioRemoto, ...localCardio.filter((t) => !idsRemotos.has(t.id))].sort((a, b) => (Date.parse(b.data) || 0) - (Date.parse(a.data) || 0));
    return {
      loading: false,
      error: entrada?.status === 'error',
      strength: {
        records: unirRecordes(forca.records, localRecords, parseDataPtBr),
        history: unirHistoricoForca(forca.history, localHistory ?? []),
        upsertRecord: upsertLocal,
      },
      cardio: { testes: todos, salvar: salvarLocal, remover: removerLocal, canRemove: (id) => !idsRemotos.has(id) },
    };
  }, [entrada?.status, forca, cardioRemoto, localRecords, localHistory, localCardio, upsertLocal, salvarLocal, removerLocal]);
}

/**
 * Recordes que valem para a Carga Alvo do usuário logado: no Aluno, o teste MAIS RECENTE entre o
 * registrado pelo Personal e o próprio; no Personal, os próprios.
 */
export function useRecordesEfetivos(): Record<string, StrRecord> {
  const isAluno = useUIStore((s) => s.isAlunoMode);
  const email = useAuthStore((s) => s.user?.email)?.toLowerCase() ?? '';
  const entrada = useTestesRemotosStore((s) => s.byEmail[email]);
  const carregar = useTestesRemotosStore((s) => s.carregar);
  const local = useStrengthStore((s) => s.records);

  useEffect(() => {
    if (isAluno && email) void carregar(email);
  }, [isAluno, email, carregar]);

  const docs = entrada?.docs;
  return useMemo(() => {
    if (!isAluno) return local;
    const remoto = derivarForca((docs ?? []).filter((d): d is TesteForcaDoc => d.tipo === 'forca')).records;
    return unirRecordes(remoto, local, parseDataPtBr);
  }, [isAluno, docs, local]);
}
