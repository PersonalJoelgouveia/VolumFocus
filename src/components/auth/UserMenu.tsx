import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import './UserMenu.css';

/**
 * Sucessor de #btn-vf-login/#vf-logout-link (index.html ~2566-2570) e
 * #personal-mode-badge (~2533-2536). Como o AuthGate já garante um usuário
 * logado e autorizado antes de qualquer view renderizar, aqui não existe
 * mais estado "deslogado" — só o chip com avatar/nome + sair, e o badge de
 * Personal quando isPersonalMode estiver ativo.
 */
export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const logout = useAuthStore((s) => s.logout);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);

  if (!user) return null;

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
