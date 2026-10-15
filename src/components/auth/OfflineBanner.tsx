import { useState } from 'react';
import { INDISPONIVEL_OFFLINE, useOnline } from '../../lib/connectivity';

/**
 * Aviso de modo offline. Dados sensíveis (avaliações, anotações, rascunhos) NÃO são gravados em disco
 * sem conexão: ficam só na memória desta aba e se perdem ao recarregar ou sair. Lista o que fica
 * indisponível para o usuário não descobrir só ao falhar.
 */
export function OfflineBanner() {
  const online = useOnline();
  const [aberto, setAberto] = useState(false);
  if (online) return null;
  return (
    <div className="vf-offline-banner" role="status" aria-live="polite">
      <strong>Sem conexão.</strong> Dados de clientes ficam só na memória desta aba (se recarregar, são perdidos).{' '}
      <button type="button" className="vf-offline-more" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
        {aberto ? 'Ocultar' : 'O que fica indisponível?'}
      </button>
      {aberto && (
        <ul>
          {INDISPONIVEL_OFFLINE.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
