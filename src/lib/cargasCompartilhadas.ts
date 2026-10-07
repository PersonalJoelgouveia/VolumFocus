import { db, doc, getDoc, setDoc } from './firebase';
import { normalizarMapaCargas } from '../utils/cargasCompartilhadas';
import type { CargaCompartilhada, MapaCargas, PapelCarga } from '../utils/cargasCompartilhadas';
import { chaveExercicio } from '../utils/cargasCompartilhadas';

/**
 * Cargas "vivas" de um aluno: `alunos/{email}/cargas/atuais` = { cargas: { [nome normalizado]:
 * { carga, em, por } }, atualizadoEm }. Aluno E Personal gravam aqui quando mudam o peso de um
 * exercício; o outro lado lê (polling) e aplica na própria semana. É um documento à parte da
 * rotina: a prescrição (rotinas/{id}) continua imutável e versionada.
 */
const DEBOUNCE_MS = 1500;

function ref(email: string) {
  return doc(db, 'alunos', email.toLowerCase(), 'cargas', 'atuais');
}

type Pendentes = Record<string, Record<string, CargaCompartilhada>>; // email -> chave -> carga
let pendentes: Pendentes = {};
let timer: ReturnType<typeof setTimeout> | null = null;

/** Chaves com gravação ainda não enviada — não devem ser sobrescritas por uma leitura remota. */
export function chavesPendentes(email: string): ReadonlySet<string> {
  return new Set(Object.keys(pendentes[email.toLowerCase()] ?? {}));
}

export async function lerCargasCompartilhadas(email: string): Promise<MapaCargas> {
  const snap = await getDoc(ref(email));
  return snap.exists() ? normalizarMapaCargas((snap.data() as { cargas?: unknown }).cargas) : {};
}

export async function descarregarCargasPendentes(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const lote = pendentes;
  pendentes = {};
  for (const [email, cargas] of Object.entries(lote)) {
    try {
      await setDoc(ref(email), { cargas, atualizadoEm: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error('cargasCompartilhadas: falha ao gravar cargas', e);
      // Recoloca o que não foi substituído por algo mais novo, para a próxima tentativa.
      pendentes[email] = { ...cargas, ...pendentes[email] };
    }
  }
}

/** Agenda a gravação (debounce; vários toques de +/- viram uma escrita só). Último valor vence. */
export function registrarCargaEditada(email: string, nomeExercicio: string, carga: number, por: PapelCarga): void {
  const key = chaveExercicio(nomeExercicio);
  if (!key || !email || !Number.isFinite(carga) || carga < 0) return;
  const e = email.toLowerCase();
  pendentes[e] = { ...pendentes[e], [key]: { carga, em: new Date().toISOString(), por } };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void descarregarCargasPendentes(), DEBOUNCE_MS);
}

/** Uma nova rotina publicada substitui as cargas vivas (a prescrição nova é a referência). Best-effort. */
export async function limparCargasCompartilhadas(email: string): Promise<void> {
  try {
    delete pendentes[email.toLowerCase()];
    await setDoc(ref(email), { cargas: {}, atualizadoEm: new Date().toISOString() });
  } catch (e) {
    console.error('cargasCompartilhadas: falha ao limpar cargas', e);
  }
}

/** Só para testes. */
export function _resetCargasPendentes(): void {
  pendentes = {};
  if (timer) clearTimeout(timer);
  timer = null;
}
