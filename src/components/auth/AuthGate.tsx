import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import './AuthGate.css';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Sucessor de #vf-gate-overlay + vfGate (index.html ~2398-2419,
 * ~7760-7845): três telas — verificando / login / acesso negado — e só
 * renderiza `children` (o app) quando o status vira 'granted'. Chama
 * useAuthStore.init() uma única vez ao montar.
 */
export function AuthGate({ children }: AuthGateProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const errorMessage = useAuthStore((s) => s.errorMessage);
  const init = useAuthStore((s) => s.init);
  const login = useAuthStore((s) => s.login);
  const tryAnotherAccount = useAuthStore((s) => s.tryAnotherAccount);

  useEffect(() => {
    init();
  }, [init]);

  if (status === 'granted') return <>{children}</>;

  return (
    <div className="vf-gate-overlay">
      <div className="vf-gate-box">
        {status === 'loading' && (
          <div className="vf-gate-state">
            <div className="vf-gate-spinner" />
            <p>Verificando acesso…</p>
          </div>
        )}

        {status === 'login' && (
          <div className="vf-gate-state">
            <h2>VolumFocus</h2>
            <p>Entre com sua conta Google para acessar seus treinos.</p>
            {errorMessage && <p className="vf-gate-error">{errorMessage}</p>}
            <button className="btn btn-primary" disabled={busy} onClick={login}>
              {busy ? 'Conectando…' : 'Entrar com Google'}
            </button>
          </div>
        )}

        {status === 'denied' && (
          <div className="vf-gate-state">
            <h2>Acesso não autorizado</h2>
            <p>Conectado como {user?.email}</p>
            <p>Esse e-mail ainda não está cadastrado como aluno. Solicite o link de cadastro ao seu Personal Trainer.</p>
            <button className="btn btn-ghost" disabled={busy} onClick={tryAnotherAccount}>
              Tentar com outra conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
