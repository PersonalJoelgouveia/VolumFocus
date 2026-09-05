import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { useSyncStore } from '../../store/useSyncStore';
import './UserMenu.css';

const CLOUD_TITLES: Record<string, string> = {
  idle: 'Salvar na nuvem agora',
  waiting: 'Aguardando sincronização — toque para sincronizar agora',
  syncing: 'Sincronizando com a nuvem…',
  ok: 'Tudo sincronizado — toque para salvar de novo',
  error: 'Falha ao sincronizar — toque para tentar de novo',
};

/**
 * Sucessor de #btn-vf-login/#vf-logout-link (index.html ~2566-2570),
 * #personal-mode-badge (~2533-2536) e #vf-sync-dot (~2565, ~7646-7673).
 * Como o AuthGate já garante um usuário logado e autorizado antes de
 * qualquer view renderizar, aqui não existe mais estado "deslogado" — só
 * o chip com avatar/nome + sair, o badge de Personal, e o botão de nuvem.
 *
 * O antigo dot de sync era um <button> de 8px separado do botão ☁️; o
 * reset global `button { min-height: 44px }` (tokens.css) esticava ele
 * numa cápsula deformada. Unificado num botão só: o clique decide
 * reconectar (waiting/error) ou salvar (demais estados), e o status vira
 * um badge discreto no canto do próprio ícone de nuvem.
 */
export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const logout = useAuthStore((s) => s.logout);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  const syncStatus = useSyncStore((s) => s.status);
  const reconnect = useSyncStore((s) => s.reconnect);
  const saveNow = useSyncStore((s) => s.saveNow);

  if (!user) return null;

  function handleCloudClick() {
    if (syncStatus === 'waiting' || syncStatus === 'error') reconnect();
    else saveNow();
  }

  return (
    <div className="user-menu">
      {isPersonalMode && (
        <span
          className="pt-badge"
          title="Você está logado como Personal Trainer — as rotinas que você editar aqui serão publicadas para o aluno."
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
          </svg>
          PERSONAL ATIVO
        </span>
      )}

      <button
        className="btn btn-ghost btn-icon btn-sm vf-cloud-btn"
        onClick={handleCloudClick}
        title={CLOUD_TITLES[syncStatus] ?? CLOUD_TITLES.idle}
        aria-label="Sincronizar com a nuvem"
      >
        ☁️
        <span className={`vf-cloud-badge vf-sync-${syncStatus}`} aria-hidden="true" />
      </button>

      <div className="user-chip" title={user.email}>
        {user.picture ? (
          <img className="user-chip-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="user-chip-avatar user-chip-avatar-fallback">{user.name[0]?.toUpperCase()}</span>
        )}
        <span className="user-chip-name">{user.name.split(' ')[0]}</span>
        <button className="user-chip-logout" disabled={busy} onClick={logout} title="Sair da conta Google">
          sair
        </button>
      </div>
    </div>
  );
}
