import { useCallback, useEffect, useState } from 'react';
import {
  buscarEstados,
  buscarVinculosDoResponsavel,
  exportarEventos,
  registrarDecisao,
  type EstadosPorFinalidade,
  type VinculoResponsavel,
} from '../../lib/consentimentoRepository';
import { exigirOnline } from '../../lib/connectivity';
import { FINALIDADES, TEXTOS_CONSENTIMENTO, estadoVigente, type Decisao, type Finalidade } from '../../lib/consentimento';

interface Props {
  email: string;
  busy: boolean;
  onSwitchAccount: () => void;
}

interface Item {
  vinculo: VinculoResponsavel;
  estados: EstadosPorFinalidade;
}

interface Pendente {
  alunoEmail: string;
  finalidade: Finalidade;
  decisao: Decisao;
}

function rotulo(estados: EstadosPorFinalidade, f: Finalidade, resp: string): { texto: string; cls: string } {
  const e = estados[f];
  if (!e) return { texto: 'Sem decisão', cls: 'pendente' };
  if (e.decisao === 'aceito') {
    return estadoVigente(e, resp)
      ? { texto: 'Autorizado', cls: 'ok' }
      : { texto: 'Texto atualizado — decida de novo', cls: 'pendente' };
  }
  return e.decisao === 'recusado' ? { texto: 'Recusado', cls: 'neg' } : { texto: 'Revogado', cls: 'neg' };
}

/**
 * Painel do RESPONSÁVEL LEGAL (conta Google verificada, vinculada pelo Personal). Só ele grava a autorização;
 * o servidor (Security Rules) valida e carimba a hora. As três finalidades são decididas SEPARADAMENTE.
 * Não coleta documento, CPF nem IP.
 */
export function ResponsavelPanel({ email, busy, onSwitchAccount }: Props) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pendente, setPendente] = useState<Pendente | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const vinculos = await buscarVinculosDoResponsavel(email);
      const lista = await Promise.all(vinculos.map(async (vinculo) => ({ vinculo, estados: await buscarEstados(vinculo.alunoEmail) })));
      setItems(lista);
    } catch (e) {
      console.error('ResponsavelPanel: falha ao carregar', e);
      setErro('Não foi possível carregar as autorizações. Verifique a conexão e tente de novo.');
      setItems([]);
    }
  }, [email]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baixarHistorico(alunoEmail: string) {
    try {
      const dados = await exportarEventos(alunoEmail);
      const blob = new Blob([JSON.stringify({ alunoEmail, exportadoEm: new Date().toISOString(), eventos: dados }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historico-autorizacoes-${alunoEmail.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('ResponsavelPanel: falha ao exportar', e);
      setErro('Não foi possível baixar o histórico agora.');
    }
  }

  async function confirmar() {
    if (!pendente || salvando) return;
    if (!exigirOnline('registrar a autorização')) return;
    setSalvando(true);
    setErro(null);
    try {
      const vinc = items?.find((i) => i.vinculo.alunoEmail === pendente.alunoEmail);
      if (!vinc) throw new Error('vínculo não encontrado');
      // Corrigir/revogar = NOVO evento ligado ao anterior; o histórico nunca é reescrito.
      const anterior = (vinc.estados as Record<string, { eventoId?: string } | null>)[pendente.finalidade]?.eventoId;
      await registrarDecisao(vinc.vinculo, pendente.finalidade, pendente.decisao, email, anterior);
      setPendente(null);
      await carregar();
    } catch (e) {
      console.error('ResponsavelPanel: falha ao registrar decisão', e);
      setErro('Não foi possível registrar sua decisão. Nada foi alterado. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="vf-gate-state vf-resp-panel">
      <h2>Autorização do responsável</h2>
      <p>Conectado como {email}</p>
      {items === null && (
        <>
          <div className="vf-gate-spinner" />
          <p>Carregando…</p>
        </>
      )}
      {erro && (
        <p className="vf-gate-error" role="alert">
          {erro}
        </p>
      )}
      {items?.map(({ vinculo, estados }) => (
        <section key={vinculo.alunoEmail} className="vf-resp-card">
          <h3>{vinculo.alunoNome || vinculo.alunoEmail}</h3>
          <p className="vf-resp-sub">
            Você consta como responsável ({vinculo.parentesco || 'responsável legal'}). Cada autorização abaixo é
            independente e pode ser revogada a qualquer momento.
          </p>
          <div className="vf-resp-actions">
            <button className="btn btn-ghost" onClick={() => baixarHistorico(vinculo.alunoEmail)}>
              Baixar histórico (JSON)
            </button>
          </div>
          {FINALIDADES.map((f) => {
            const t = TEXTOS_CONSENTIMENTO[f];
            const r = rotulo(estados, f, vinculo.responsavelEmail);
            const concedido = estadoVigente(estados[f], vinculo.responsavelEmail);
            const emConfirmacao = pendente?.alunoEmail === vinculo.alunoEmail && pendente.finalidade === f;
            return (
              <div key={f} className="vf-resp-fin">
                <div className="vf-resp-fin-head">
                  <strong>{t.titulo}</strong>
                  <span className={`vf-resp-badge ${r.cls}`}>{r.texto}</span>
                </div>
                <p className="vf-resp-texto">{t.texto}</p>
                <p className="vf-resp-sub">
                  {t.obrigatoria ? 'Necessária para o acesso do aluno.' : 'Opcional.'} Versão do texto: {t.versao}
                </p>
                {emConfirmacao ? (
                  <div className="vf-resp-actions">
                    <button className="btn btn-primary" disabled={salvando} onClick={confirmar}>
                      {salvando ? 'Registrando…' : `Confirmar: ${pendente.decisao === 'aceito' ? 'autorizar' : pendente.decisao === 'recusado' ? 'recusar' : 'revogar'}`}
                    </button>
                    <button className="btn btn-ghost" disabled={salvando} onClick={() => setPendente(null)}>
                      Voltar
                    </button>
                  </div>
                ) : (
                  <div className="vf-resp-actions">
                    {!concedido && (
                      <button className="btn btn-primary" disabled={salvando} onClick={() => setPendente({ alunoEmail: vinculo.alunoEmail, finalidade: f, decisao: 'aceito' })}>
                        Autorizar
                      </button>
                    )}
                    {!concedido && estados[f]?.decisao !== 'recusado' && (
                      <button className="btn btn-ghost" disabled={salvando} onClick={() => setPendente({ alunoEmail: vinculo.alunoEmail, finalidade: f, decisao: 'recusado' })}>
                        Recusar
                      </button>
                    )}
                    {concedido && (
                      <button className="btn btn-ghost" disabled={salvando} onClick={() => setPendente({ alunoEmail: vinculo.alunoEmail, finalidade: f, decisao: 'revogado' })}>
                        Revogar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <button className="btn btn-ghost" disabled={busy} onClick={onSwitchAccount}>
        {busy ? 'Saindo…' : 'Sair / trocar de conta'}
      </button>
    </div>
  );
}
