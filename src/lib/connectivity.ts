import { useSyncExternalStore } from 'react';
import { getLocalAuthUid } from './localOwner';
import { useUIStore } from '../store/useUIStore';

/**
 * Conectividade e política de dados sensíveis (modo online/offline).
 *
 * `navigator.onLine` só indica que há rede local — não prova que o Firebase responde nem que a sessão é
 * válida. Por isso a autorização de verdade continua nas Security Rules; aqui só se decide o que o APP
 * grava no aparelho e quais ações ele oferece.
 */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/**
 * Dado sensível só vai para armazenamento PERSISTENTE com rede E contexto autorizado (conta Personal/aluno
 * liberada pelo gate). Offline, ou sem contexto autorizado, fica só em memória.
 */
export function podePersistirSensivel(): boolean {
  return isOnline() && getLocalAuthUid() !== null;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}

/** Funções que exigem validação online e ficam indisponíveis sem conexão (mostradas ao usuário). */
export const INDISPONIVEL_OFFLINE = [
  'Cadastrar ou editar alunos',
  'Registrar, editar ou apagar avaliações físicas (inclui avaliação online)',
  'Criar ou remover anotações/prontuário (editar uma anotação já aberta fica só na memória até reconectar)',
  'Autorização do responsável legal',
  'Backup e sincronização',
] as const;

/** Retorna true se há conexão; senão avisa o usuário e retorna false (a ação NÃO deve prosseguir). */
export function exigirOnline(acao: string): boolean {
  if (isOnline()) return true;
  useUIStore.getState().showToast(`Sem conexão: não é possível ${acao} agora. Reconecte e tente de novo.`, 'error');
  return false;
}
