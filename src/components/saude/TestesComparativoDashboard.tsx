import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStrengthStore } from '../../store/useStrengthStore';
import { useCardioTestStore } from '../../store/useCardioTestStore';
import {
  classificarTendencia,
  montarSeriesCardio,
  montarSeriesForca,
  type PontoTeste,
  type Tendencia,
} from '../../utils/testesComparativo';
import './TestesComparativoDashboard.css';

const TEND: Record<Tendencia, { icone: string; texto: string; cls: string }> = {
  melhora: { icone: '▲', texto: 'Melhora', cls: 'tcd-up' },
  manutencao: { icone: '●', texto: 'Manutenção', cls: 'tcd-flat' },
  regressao: { icone: '▼', texto: 'Regressão', cls: 'tcd-down' },
};

const fmtData = (ts: number) => (ts ? new Date(ts).toLocaleDateString('pt-BR') : '—');
const fmtDelta = (d: number, un: string) => `${d >= 0 ? '+' : ''}${d.toFixed(1)} ${un}`;

/**
 * Dashboard comparativo dos testes de Força (1RM) e Cardiorrespiratórios.
 * Só lê o que já está salvo (useStrengthStore / useCardioTestStore) — nenhum
 * cálculo de 1RM/VO2 é refeito. Séries separadas por exercício+fórmula
 * (força) e modalidade+protocolo (cardio): protocolos diferentes nunca são
 * comparados entre si. Reativo aos stores → atualiza sozinho após novo teste.
 */
export function TestesComparativoDashboard({ tipo }: { tipo: 'forca' | 'cardio' }) {
  const history = useStrengthStore((s) => s.history);
  const records = useStrengthStore((s) => s.records);
  const testes = useCardioTestStore((s) => s.testes);

  const series = useMemo(
    () => (tipo === 'forca' ? montarSeriesForca(history ?? [], records) : montarSeriesCardio(testes)),
    [tipo, history, records, testes],
  );

  const [serieKey, setSerieKey] = useState<string | null>(null);
  const [desmarcados, setDesmarcados] = useState<Record<string, string[]>>({});

  const serie = series.find((s) => s.key === serieKey) ?? series[0];
  const titulo = tipo === 'forca' ? 'Força 1RM' : 'Cardiorrespiratório (VO2 máx)';

  if (!serie) {
    return (
      <div className="card tcd">
        <div className="card-title">📊 Dashboard comparativo — {titulo}</div>
        <div className="tcd-empty">Nenhum teste salvo ainda. Realize um teste acima para ver seus resultados aqui.</div>
      </div>
    );
  }

  const off = desmarcados[serie.key] ?? [];
  const selecionados: PontoTeste[] = serie.pontos.filter((p) => !off.includes(p.id));
  const toggle = (id: string) =>
    setDesmarcados((prev) => {
      const atual = prev[serie.key] ?? [];
      return { ...prev, [serie.key]: atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id] };
    });

  const un = serie.unidade;
  const dadosGrafico = selecionados.map((p) => ({ d: fmtData(p.ts), v: p.valor }));
  const primeiro = selecionados[0];
  const ultimo = selecionados[selecionados.length - 1];
  const geral = selecionados.length >= 2 ? classificarTendencia(primeiro.valor, ultimo.valor) : null;

  return (
    <div className="card tcd">
      <div className="card-title">📊 Dashboard comparativo — {titulo}</div>

      {series.length > 1 && (
        <label className="tcd-select-wrap">
          <span>{tipo === 'forca' ? 'Exercício / fórmula' : 'Modalidade / protocolo'}</span>
          <select className="tcd-select" value={serie.key} onChange={(e) => setSerieKey(e.target.value)}>
            {series.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} ({s.pontos.length})
              </option>
            ))}
          </select>
        </label>
      )}
      {series.length === 1 && <div className="tcd-serie-nome">{serie.label}</div>}

      {serie.pontos.length < 2 ? (
        <>
          <div className="tcd-single">
            <div className="tcd-single-val">
              {serie.pontos[0].valor.toFixed(1)} <span>{un}</span>
            </div>
            <div className="tcd-single-meta">
              {fmtData(serie.pontos[0].ts)} · {serie.pontos[0].detalhe}
            </div>
          </div>
          <div className="tcd-empty">Ainda não existe histórico comparativo para este protocolo. Realize um novo teste para acompanhar sua evolução.</div>
        </>
      ) : (
        <>
          <div className="tcd-hint">Selecione 2 ou mais avaliações para comparar:</div>
          <div className="tcd-chips">
            {serie.pontos.map((p) => {
              const on = !off.includes(p.id);
              return (
                <button key={p.id} type="button" className={`tcd-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(p.id)}>
                  {fmtData(p.ts)} · {p.valor.toFixed(1)} {un}
                </button>
              );
            })}
          </div>

          {selecionados.length < 2 ? (
            <div className="tcd-empty">Selecione pelo menos duas avaliações para comparar.</div>
          ) : (
            <>
              {geral && (
                <div className={`tcd-resumo ${TEND[geral.tendencia].cls}`}>
                  <span className="tcd-badge">
                    {TEND[geral.tendencia].icone} {TEND[geral.tendencia].texto}
                  </span>
                  <span>
                    {fmtData(primeiro.ts)} → {fmtData(ultimo.ts)}: {primeiro.valor.toFixed(1)} → {ultimo.valor.toFixed(1)} {un} ({fmtDelta(geral.delta, un)} ·{' '}
                    {geral.pct >= 0 ? '+' : ''}
                    {geral.pct.toFixed(1)}%)
                  </span>
                </div>
              )}

              <div className="tcd-chart">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={dadosGrafico} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="d" tick={{ fontSize: 10, fill: 'var(--text-3)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} domain={['auto', 'auto']} width={44} unit="" />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: 'var(--rs)' }}
                      labelStyle={{ color: 'var(--text-2)', fontSize: 11 }}
                      formatter={(v: unknown) => [`${Number(v).toFixed(1)} ${un}`, 'Resultado']}
                    />
                    <Line type="monotone" dataKey="v" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--teal)' }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="tcd-table-wrap">
                <table className="tcd-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Resultado</th>
                      <th>Detalhe</th>
                      <th>vs. anterior</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selecionados.map((p, i) => {
                      const c = i > 0 ? classificarTendencia(selecionados[i - 1].valor, p.valor) : null;
                      return (
                        <tr key={p.id}>
                          <td>{fmtData(p.ts)}</td>
                          <td>
                            <strong>{p.valor.toFixed(1)}</strong> {un}
                          </td>
                          <td>{p.detalhe}</td>
                          <td>
                            {c ? (
                              <span className={`tcd-badge ${TEND[c.tendencia].cls}`}>
                                {TEND[c.tendencia].icone} {fmtDelta(c.delta, un)} ({c.pct >= 0 ? '+' : ''}
                                {c.pct.toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="tcd-base">base</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
