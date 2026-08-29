import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { useSyncStore } from '../../store/useSyncStore';
import './UserMenu.css';

const DOT_TITLES: Record<string, string> = {
  idle: 'Sincronização com a nuvem',
  waiting: 'Aguardando sincronização — toque para sincronizar agora',
  syncing: 'Sincronizando com a nuvem…',
  ok: 'Tudo sincronizado com a nuvem',
  error: 'Falha ao sincronizar — toque para tentar de novo',
};

/**
 * Sucessor de #btn-vf-login/#vf-logout-link (index.html ~2566-2570),
 * #personal-mode-badge (~2533-2536) e #vf-sync-dot (~2565, ~7646-7673).
 * Como o AuthGate já garante um usuário logado e autorizado antes de
 * qualquer view renderizar, aqui não existe mais estado "deslogado" — só
 * o chip com avatar/nome + sair, o badge de Personal, e o dot de sync.
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

  function handleDotClick() {
    if (syncStatus === 'waiting' || syncStatus === 'error') reconnect();
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
        className={`vf-sync-dot vf-sync-${syncStatus}`}
        onClick={handleDotClick}
        title={DOT_TITLES[syncStatus] ?? DOT_TITLES.idle}
        aria-label="Status de sincronização com a nuvem"
      />

      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={saveNow}
        title="Salvar na nuvem agora"
        aria-label="Salvar na nuvem agora"
      >
        ☁️
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
