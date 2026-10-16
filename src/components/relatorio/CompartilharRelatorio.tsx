import { useCallback, useEffect, useState } from 'react';
import { exigirOnline } from '../../lib/connectivity';
import {
  DIAS_VALIDADE_PADRAO,
  OPCOES_VALIDADE_DIAS,
  estadoDoShare,
  montarLink,
  type ShareDoc,
} from '../../lib/relatorioShare';
import { criarCompartilhamento, listarCompartilhamentos, revogarCompartilhamento } from '../../lib/relatorioShareRepository';

interface Props {
  alunoEmail: string;
  avaliacaoId: string;
}

const ROTULO = { ativo: 'ativo', revogado: 'revogado', expirado: 'expirado' } as const;

/**
 * Só o Personal DONO vê isto (as Rules são quem garante). O link exige LOGIN Google e conta autorizada:
 * ele não dá acesso a quem não tem conta — isso é uma decisão de produto separada (ver docs/Relatorio_Link_Protegido.md).
 * O link é mostrado uma vez e copiado; nada é guardado no navegador.
 */
export function CompartilharRelatorio({ alunoEmail, avaliacaoId }: Props) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState<number>(DIAS_VALIDADE_PADRAO);
  const [paraAluno, setParaAluno] = useState(true);
  const [itens, setItens] = useState<ShareDoc[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await listarCompartilhamentos(alunoEmail, avaliacaoId));
    } catch (e) {
      console.warn('CompartilharRelatorio: falha ao listar', e);
      setMsg('Não foi possível listar os links agora.');
    }
  }, [alunoEmail, avaliacaoId]);

  useEffect(() => {
    if (aberto) void carregar();
  }, [aberto, carregar]);

  async function criar() {
    if (ocupado || !exigirOnline('criar o link protegido')) return;
    setOcupado(true);
    setMsg(null);
    try {
      const id = await criarCompartilhamento(alunoEmail, avaliacaoId, { dias, paraAluno });
      const url = montarLink(window.location.href, id);
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        setMsg('Link criado e copiado. Quem abrir precisará entrar com a conta Google autorizada.');
      } catch {
        setMsg('Link criado. Copie-o abaixo.');
      }
      await carregar();
    } catch (e) {
      console.error('CompartilharRelatorio: falha ao criar', e);
      setMsg('Não foi possível criar o link. Verifique a conexão e as permissões.');
    } finally {
      setOcupado(false);
    }
  }

  async function revogar(id: string) {
    if (ocupado || !exigirOnline('revogar o link')) return;
    setOcupado(true);
    try {
      await revogarCompartilhamento(id);
      setMsg('Link revogado.');
      await carregar();
    } catch (e) {
      console.error('CompartilharRelatorio: falha ao revogar', e);
      setMsg('Não foi possível revogar agora. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setAberto(true)}>
        Link protegido…
      </button>
    );
  }

  return (
    <div className="rel-share">
      <div className="rel-share-row">
        <label>
          Validade{' '}
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {OPCOES_VALIDADE_DIAS.map((d) => (
              <option key={d} value={d}>{d} dia{d > 1 ? 's' : ''}</option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={paraAluno} onChange={(e) => setParaAluno(e.target.checked)} /> o aluno também pode abrir
        </label>
        <button type="button" className="btn btn-primary" disabled={ocupado} onClick={criar}>Criar link</button>
        <button type="button" className="btn btn-ghost" onClick={() => setAberto(false)}>Ocultar</button>
      </div>
      {link && <input className="rel-share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link protegido" />}
      {msg && <div role="status" className="rel-share-msg">{msg}</div>}
      <ul className="rel-share-lista">
        {itens.map((s) => {
          const st = estadoDoShare(s);
          return (
            <li key={s.shareId}>
              <span>{s.criadoEm ? s.criadoEm.toLocaleDateString('pt-BR') : '—'} → {s.expiraEm ? s.expiraEm.toLocaleDateString('pt-BR') : '—'} · {ROTULO[st]}{s.paraAluno ? ' · aluno' : ''}</span>
              {st === 'ativo' && (
                <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={() => revogar(s.shareId)}>Revogar</button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
