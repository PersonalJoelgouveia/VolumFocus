import { useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { DAYS } from '../types/workout';
import '../components/clientes/ClientesView.css';
import '../components/feedback/Notifications.css';

/**
 * Sucessor de #view-notifications (index.html ~3261) + ntf_render/
 * ntf_onViewOpen (~10447-10500). Só cobre o fluxo "Treino concluído" —
 * o outro fluxo unificado ali no original, "Solicitação de cadastro" via
 * link de convite (cli_pendentes), depende do formulário público
 * ?convite=1, que é uma frente à parte ainda não portada.
 */
export function NotificationsView() {
  const items = useNotificationStore((s) => s.items);
  const loading = useNotificationStore((s) => s.loading);
  const loaded = useNotificationStore((s) => s.loaded);
  const fetchAll = useNotificationStore((s) => s.fetchAll);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const dismiss = useNotificationStore((s) => s.dismiss);

  // Sucessor de ntf_onViewOpen(): recarrega e marca tudo como lido ao abrir a aba.
  useEffect(() => {
    fetchAll().then(() => markAllRead());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="sec-row">
        <div className="page-title">
          Notificações <span className="tag">TREINOS CONCLUÍDOS</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchAll} disabled={loading}>
          {loading ? 'Atualizando…' : '🔄 Atualizar'}
        </button>
      </div>

      {loading && !loaded ? (
        <div className="cli-empty">Carregando notificações…</div>
      ) : items.length === 0 ? (
        <div className="cli-empty">Nenhuma notificação por aqui. 🎉</div>
      ) : (
        <div className="ntf-list">
          {items.map((n) => (
            <div className="card ntf-card" key={n.id}>
              <div className="ntf-card-top">
                <div className="ntf-icon ntf-icon-treino">✅</div>
                <div className="ntf-info">
                  <div className="ntf-title">Treino concluído</div>
                  <div className="ntf-meta">
                    {n.alunoNome} · {DAYS[n.dia]} · {new Date(n.criadaEm).toLocaleString('pt-BR')}
                  </div>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" title="Dispensar" onClick={() => dismiss(n.id)}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
