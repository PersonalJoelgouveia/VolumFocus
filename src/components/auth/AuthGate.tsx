import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ResponsavelPanel } from './ResponsavelPanel';
import './AuthGate.css';

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Sucessor de #vf-gate-overlay + vfGate (index.html ~2398-2419,
 * ~7760-7845): três telas — verificando / login / acesso negado — e só
 * renderiza `children` (o app) quando o status vira 'granted'. Chama
 * useAuthStore.init() uma única vez ao montar.
 *
 * Login e cadastro são o MESMO fluxo (Google): o papel nunca é escolhido aqui. Personal = e-mail da
 * lista fixa; aluno = e-mail cadastrado pelo Personal (alunos/{email}, criado só pelas Rules). A
 * escolha "Sou Personal / Sou aluno" apenas muda o texto de orientação. Nada é gravado no cadastro.
 */
type Intent = 'aluno' | 'personal';

export function AuthGate({ children }: AuthGateProps) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const errorMessage = useAuthStore((s) => s.errorMessage);
  const errorKind = useAuthStore((s) => s.errorKind);
  const init = useAuthStore((s) => s.init);
  const login = useAuthStore((s) => s.login);
  const tryAnotherAccount = useAuthStore((s) => s.tryAnotherAccount);

  const [intent, setIntent] = useState<Intent>('aluno');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(user?.email ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o e-mail continua visível na tela */
    }
  }

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
            <div className="vf-gate-tabs" role="tablist" aria-label="Tipo de acesso">
              <button
                type="button"
                role="tab"
                aria-selected={intent === 'aluno'}
                className={`vf-gate-tab${intent === 'aluno' ? ' active' : ''}`}
                onClick={() => setIntent('aluno')}
              >
                Sou aluno
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={intent === 'personal'}
                className={`vf-gate-tab${intent === 'personal' ? ' active' : ''}`}
                onClick={() => setIntent('personal')}
              >
                Sou Personal
              </button>
            </div>
            <p>
              {intent === 'aluno'
                ? 'Entre com a conta Google do e-mail que seu Personal cadastrou. No primeiro acesso, seus treinos são vinculados à sua conta automaticamente.'
                : 'Entre com a conta Google autorizada do Personal Trainer.'}
            </p>
            {errorMessage && (
              <p className={errorKind === 'info' ? 'vf-gate-info' : 'vf-gate-error'} role="alert">
                {errorMessage}
              </p>
            )}
            <button className="btn btn-primary" disabled={busy} onClick={login}>
              {busy ? 'Conectando…' : 'Entrar com Google'}
            </button>
          </div>
        )}

        {status === 'denied' && (
          <div className="vf-gate-state">
            <h2>Acesso não autorizado</h2>
            <p>Conectado como {user?.email}</p>
            <p>
              {intent === 'personal'
                ? 'Esta conta Google não tem permissão de Personal Trainer. Use a conta autorizada.'
                : 'Esse e-mail ainda não está cadastrado como aluno. Envie-o ao seu Personal Trainer para que ele faça o seu cadastro, ou entre com outra conta.'}
            </p>
            {errorMessage && <p className="vf-gate-error" role="alert">{errorMessage}</p>}
            <button className="btn btn-primary" disabled={busy} onClick={copyEmail}>
              {copied ? 'E-mail copiado ✓' : 'Copiar meu e-mail'}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={tryAnotherAccount}>
              {busy ? 'Saindo…' : 'Tentar com outra conta'}
            </button>
          </div>
        )}

        {status === 'responsavel' && user && (
          <ResponsavelPanel email={user.email} busy={busy} onSwitchAccount={tryAnotherAccount} />
        )}

        {status === 'guardian-pending' && (
          <div className="vf-gate-state">
            <h2>Aguardando responsável</h2>
            <p>Conectado como {user?.email}</p>
            <p>
              Como você é menor de 18 anos, o acesso depende da autorização do seu responsável legal. Peça a ele que entre no
              VolumFocus com a conta Google indicada ao seu Personal e confirme a autorização. Depois, toque em "Verificar de novo".
            </p>
            <button className="btn btn-primary" disabled={busy} onClick={() => window.location.reload()}>
              Verificar de novo
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={tryAnotherAccount}>
              Tentar com outra conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
