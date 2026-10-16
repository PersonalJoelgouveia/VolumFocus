import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useOnline } from '../../lib/connectivity';
import { MENSAGEM_LINK_INDISPONIVEL, estadoDoShare, type ShareDoc } from '../../lib/relatorioShare';
import {
  carregarCompartilhamento,
  carregarDadosDoLink,
  registrarAcesso,
  type DadosDoLink,
} from '../../lib/relatorioShareRepository';
import { RelatorioAvaliacao } from './RelatorioAvaliacao';
import './RelatorioAvaliacao.css';

interface Props {
  shareId: string;
  onClose: () => void;
}

type Estado = { tipo: 'carregando' } | { tipo: 'negado' } | { tipo: 'offline' } | { tipo: 'ok'; share: ShareDoc; dados: DadosDoLink };

/**
 * Página do link. Só é montada DENTRO do AuthGate (logado, Google verificado, conta autorizada). Aqui a
 * autorização é decidida de novo pelo Firebase: o ponteiro só é lido se as Rules deixarem (Personal dono ou
 * aluno destinatário), e as avaliações são lidas com as credenciais de quem abriu. Qualquer falha — link
 * inexistente, adulterado, de outro dono, revogado, expirado — vira a MESMA mensagem genérica.
 * Dados ficam só em memória (sem localStorage/IndexedDB); a página pede `noindex` e sem referrer.
 */
export function RelatorioLink({ shareId, onClose }: Props) {
  const role = useAuthStore((s) => s.role);
  const online = useOnline();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  useEffect(() => {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    const r = document.createElement('meta');
    r.name = 'referrer';
    r.content = 'no-referrer';
    document.head.append(m, r);
    return () => {
      m.remove();
      r.remove();
    };
  }, []);

  useEffect(() => {
    if (!online) {
      setEstado({ tipo: 'offline' });
      return;
    }
    let vivo = true;
    setEstado({ tipo: 'carregando' });
    (async () => {
      try {
        const share = await carregarCompartilhamento(shareId);
        // Checagem de UX; o gate real é das Rules (aluno) e da expiração/revogação aqui para o Personal também.
        if (estadoDoShare(share) !== 'ativo') throw new Error('inativo');
        const dados = await carregarDadosDoLink(share);
        if (!dados.assessments.some((a) => a.id === share.avaliacaoId)) throw new Error('avaliação ausente');
        if (!vivo) return;
        setEstado({ tipo: 'ok', share, dados });
        void registrarAcesso(shareId, role === 'personal' ? 'personal' : 'aluno', 'abriu');
      } catch {
        if (vivo) setEstado({ tipo: 'negado' });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [shareId, online, role]);

  if (estado.tipo === 'ok') {
    return (
      <RelatorioAvaliacao
        nome={estado.dados.nome}
        avaliacaoId={estado.share.avaliacaoId}
        assessments={estado.dados.assessments}
        onClose={onClose}
        onPrint={() => void registrarAcesso(shareId, role === 'personal' ? 'personal' : 'aluno', 'gerou_pdf')}
      />
    );
  }
  return (
    <div className="rel-msg" role="status">
      {estado.tipo === 'carregando' && <p>Verificando o seu acesso…</p>}
      {estado.tipo === 'offline' && <p>Sem conexão. O relatório só abre online.</p>}
      {estado.tipo === 'negado' && <p>{MENSAGEM_LINK_INDISPONIVEL}</p>}
      <button type="button" className="btn btn-ghost" onClick={onClose}>Ir para o app</button>
    </div>
  );
}
