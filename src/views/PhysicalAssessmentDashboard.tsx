import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAlunoStore } from '../store/useAlunoStore';
import type { PhysicalAssessment } from '../types/assessment';
import { PHOTO_POSES, getPhotoObjectUrl, getPhotosByAssessment, type PhotoPose } from '../lib/assessmentPhotoStore';
import {
  CIRCUMFERENCE_GROUPS,
  METRICAS,
  METRICAS_EVOLUCAO,
  buildResumoCards,
  buildSerieMetrica,
  buildSeriesCircunferencia,
  buildSeriesDobras,
  buildSerieSomaDobras,
  calcularComparativo,
  formatarDiferenca,
  formatarValor,
  formatarVariacaoPercentual,
  type ComparativoModo,
  type MetricKey,
  type SeriePonto,
} from '../utils/assessmentDashboard';
import { SKINFOLD_SITES, SKINFOLD_SITE_LABELS } from '../utils/pollock7';
import { formatarDataCurta } from '../utils/timelineDate';
import '../components/clientes/ClientesView.css';
import './PhysicalAssessmentDashboard.css';

interface PhysicalAssessmentDashboardProps {
  alunoId: string;
  onClose: () => void;
  /** Abre a comparação (seletor de 2 avaliações) — botão da seção de Fotos. */
  onComparar?: () => void;
}

const CORES_SERIE = ['var(--teal)', 'var(--purple)'];

function GraficoLinha({ titulo, unidade, pontos }: { titulo: string; unidade: string; pontos: SeriePonto[] }) {
  if (pontos.length === 0) {
    return (
      <div className="pad-chart-card">
        <div className="pad-chart-title">{titulo}</div>
        <div className="pad-chart-empty">Sem dados suficientes ainda.</div>
      </div>
    );
  }

  const dados = pontos.map((p) => ({ data: formatarDataCurta(p.date), valor: p.valor }));

  return (
    <div className="pad-chart-card">
      <div className="pad-chart-title">{titulo}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dados} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-md)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={{ stroke: 'var(--border-md)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} width={44} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: 'var(--rs)' }}
            labelStyle={{ color: 'var(--text-2)', fontSize: 11 }}
            itemStyle={{ color: 'var(--teal)', fontSize: 12 }}
            formatter={(value: unknown) => [formatarValor(Number(value), unidade), titulo]}
          />
          <Line type="monotone" dataKey="valor" stroke="var(--teal)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function GraficoMultiSerie({
  titulo,
  unidade,
  series,
}: {
  titulo: string;
  unidade: string;
  series: Array<{ ladoLabel: string; pontos: SeriePonto[] }>;
}) {
  if (series.length === 0) {
    return (
      <div className="pad-chart-card">
        <div className="pad-chart-title">{titulo}</div>
        <div className="pad-chart-empty">Sem dados suficientes ainda.</div>
      </div>
    );
  }

  const datasUnicas = Array.from(new Set(series.flatMap((s) => s.pontos.map((p) => p.date)))).sort();
  const dados = datasUnicas.map((date) => {
    const linha: Record<string, string | number> = { data: formatarDataCurta(date) };
    series.forEach((s) => {
      const ponto = s.pontos.find((p) => p.date === date);
      if (ponto) linha[s.ladoLabel] = ponto.valor;
    });
    return linha;
  });

  return (
    <div className="pad-chart-card">
      <div className="pad-chart-title">{titulo}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dados} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border-md)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={{ stroke: 'var(--border-md)' }} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} width={44} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border-md)', borderRadius: 'var(--rs)' }}
            labelStyle={{ color: 'var(--text-2)', fontSize: 11 }}
            formatter={(value: unknown, nome: unknown) => [formatarValor(Number(value), unidade), String(nome)]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Line
              key={s.ladoLabel}
              type="monotone"
              dataKey={s.ladoLabel}
              stroke={CORES_SERIE[i % CORES_SERIE.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const COMPOSICAO_KEYS: MetricKey[] = ['peso', 'percentualGordura', 'massaGordaKg', 'percentualMassaMagra', 'massaMagraKg'];
const INDICADORES_KEYS: MetricKey[] = ['imc', 'relacaoCinturaQuadril'];
type EvolucaoCategoria = 'composicao' | 'indicadores' | 'perimetria' | 'dobras';
const EVOLUCAO_CATEGORIAS: Array<{ key: EvolucaoCategoria; label: string }> = [
  { key: 'composicao', label: 'Composição corporal' },
  { key: 'indicadores', label: 'Indicadores' },
  { key: 'perimetria', label: 'Perimetria' },
  { key: 'dobras', label: 'Dobras' },
];

/**
 * Seção "Evolução da Avaliação" — diferente da Seção 2 (que já mostra a
 * evolução completa com TODAS as avaliações). Aqui o Personal/Aluno
 * escolhe 2 ou 3 avaliações específicas pra comparar, agrupadas por
 * categoria de unidade (nunca combina kg/%% no mesmo eixo — cada métrica
 * de Composição corporal e Indicadores continua em gráfico próprio;
 * só Perimetria/Dobras combinam séries, pois todas usam a mesma unidade).
 * Reaproveita os mesmos `buildSerieX` de assessmentDashboard.ts — só
 * alimentados com o subconjunto selecionado em vez do histórico inteiro.
 */
function EvolucaoAvaliacaoSection({ assessments }: { assessments: PhysicalAssessment[] }) {
  const porDataDesc = useMemo(
    () => [...assessments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [assessments]
  );

  // Padrão: as 2 avaliações mais recentes já vêm selecionadas — evita tela
  // vazia no primeiro carregamento.
  const [selecionadosIds, setSelecionadosIds] = useState<string[]>(() => porDataDesc.slice(0, 2).map((a) => a.id));
  const [categoria, setCategoria] = useState<EvolucaoCategoria>('composicao');
  const [grupoCircIdx, setGrupoCircIdx] = useState(0);
  const [siteDobraIdx, setSiteDobraIdx] = useState(0);

  const selecionadas = useMemo(
    () => assessments.filter((a) => selecionadosIds.includes(a.id)),
    [assessments, selecionadosIds]
  );
  const temDobrasSelecionadas = useMemo(() => selecionadas.some((a) => a.protocol === 'skinfold'), [selecionadas]);

  function alternarSelecao(id: string) {
    setSelecionadosIds((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= 3) return atual; // máximo 3 — não substitui silenciosamente
      return [...atual, id];
    });
  }

  if (assessments.length < 2) {
    return (
      <section className="pad-section">
        <h3 className="pad-section-title">Evolução da Avaliação</h3>
        <div className="pad-chart-empty">Realize outra avaliação para acompanhar sua evolução.</div>
      </section>
    );
  }

  const metricasCategoria = categoria === 'composicao' ? COMPOSICAO_KEYS : categoria === 'indicadores' ? INDICADORES_KEYS : [];
  const grupoCirc = CIRCUMFERENCE_GROUPS[grupoCircIdx];
  const seriesCircSelecionadas = buildSeriesCircunferencia(selecionadas, grupoCirc);
  const seriesDobrasSelecionadas = buildSeriesDobras(selecionadas);
  const somaDobrasSelecionadas = buildSerieSomaDobras(selecionadas);

  return (
    <section className="pad-section">
      <h3 className="pad-section-title">Evolução da Avaliação</h3>

      <div className="pad-evo-picker">
        {porDataDesc.map((a) => {
          const marcado = selecionadosIds.includes(a.id);
          const desabilitado = !marcado && selecionadosIds.length >= 3;
          return (
            <label key={a.id} className={`pad-evo-check${marcado ? ' active' : ''}${desabilitado ? ' disabled' : ''}`}>
              <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={() => alternarSelecao(a.id)} />
              {formatarDataCurta(a.date)}
            </label>
          );
        })}
      </div>

      {selecionadosIds.length < 2 ? (
        <div className="pad-chart-empty">Selecione pelo menos 2 avaliações para comparar.</div>
      ) : (
        <>
          <div className="pad-selector-row">
            {EVOLUCAO_CATEGORIAS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`pad-chip${c.key === categoria ? ' active' : ''}`}
                onClick={() => setCategoria(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {(categoria === 'composicao' || categoria === 'indicadores') &&
            metricasCategoria.map((key) => {
              const metric = METRICAS.find((m) => m.key === key)!;
              const pontos = buildSerieMetrica(selecionadas, metric);
              return <GraficoLinha key={key} titulo={metric.label} unidade={metric.unidade} pontos={pontos} />;
            })}

          {categoria === 'perimetria' && (
            <>
              <div className="pad-selector-row">
                {CIRCUMFERENCE_GROUPS.map((g, i) => (
                  <button
                    key={g.label}
                    type="button"
                    className={`pad-chip${i === grupoCircIdx ? ' active' : ''}`}
                    onClick={() => setGrupoCircIdx(i)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <GraficoMultiSerie titulo={grupoCirc.label} unidade="cm" series={seriesCircSelecionadas} />
            </>
          )}

          {categoria === 'dobras' &&
            (temDobrasSelecionadas ? (
              <>
                <div className="pad-selector-row">
                  {SKINFOLD_SITES.map((site, i) => (
                    <button
                      key={site}
                      type="button"
                      className={`pad-chip${i === siteDobraIdx ? ' active' : ''}`}
                      onClick={() => setSiteDobraIdx(i)}
                    >
                      {SKINFOLD_SITE_LABELS[site]}
                    </button>
                  ))}
                </div>
                <GraficoLinha
                  titulo={seriesDobrasSelecionadas[siteDobraIdx].label}
                  unidade="mm"
                  pontos={seriesDobrasSelecionadas[siteDobraIdx].pontos}
                />
                <GraficoLinha titulo="Soma das 7 dobras" unidade="mm" pontos={somaDobrasSelecionadas} />
              </>
            ) : (
              <div className="pad-chart-empty">Nenhuma das avaliações selecionadas usou o protocolo de Dobras.</div>
            ))}
        </>
      )}
    </section>
  );
}

function MiniaturasFotos({ assessment }: { assessment: PhysicalAssessment }) {
  const [urls, setUrls] = useState<Partial<Record<PhotoPose, string>>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const referencias = await getPhotosByAssessment(assessment.id);
        const novasUrls: Partial<Record<PhotoPose, string>> = {};
        for (const pose of PHOTO_POSES) {
          if (referencias[pose]) {
            const url = await getPhotoObjectUrl(assessment.id, pose);
            if (url) novasUrls[pose] = url;
          }
        }
        if (!cancelado) setUrls(novasUrls);
      } catch (e) {
        console.error('PhysicalAssessmentDashboard: falha ao carregar miniaturas', e);
      } finally {
        if (!cancelado) setCarregado(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [assessment.id]);

  const temFoto = Object.keys(urls).length > 0;

  return (
    <div className="pad-fotos-col">
      <div className="pad-fotos-data">{formatarDataCurta(assessment.date)}</div>
      {!carregado ? (
        <div className="pad-chart-empty">Carregando…</div>
      ) : temFoto ? (
        <div className="pad-fotos-thumbs">
          {PHOTO_POSES.filter((p) => urls[p]).map((pose) => (
            <img key={pose} src={urls[pose]} alt="Foto comparativa" className="pad-foto-thumb" />
          ))}
        </div>
      ) : (
        <div className="pad-chart-empty">Esta avaliação não possui fotos comparativas.</div>
      )}
    </div>
  );
}


/**
 * Dashboard de evolução física — Personal e Aluno (mesma leitura, sem
 * escrita aqui). Não modifica PerformanceView. Usa recharts (única
 * biblioteca de gráficos que o projeto tem — precisa ser instalada com
 * `npm install recharts`, não veio nas dependências existentes).
 *
 * Nenhum dado é inventado: métrica/ponto/lado que nenhuma avaliação
 * registrou simplesmente não aparece (ver utils/assessmentDashboard.ts).
 */
export function PhysicalAssessmentDashboard({ alunoId, onClose, onComparar }: PhysicalAssessmentDashboardProps) {
  const assessments = useAlunoStore((s) => s.getAvaliacoes(alunoId));

  const [grupoCircIdx, setGrupoCircIdx] = useState(0);
  const [siteDobraIdx, setSiteDobraIdx] = useState(0);
  const [metricaComparativo, setMetricaComparativo] = useState<MetricKey>('peso');
  const [modoComparativo, setModoComparativo] = useState<ComparativoModo>('anterior-atual');

  // Memoizado por dependência específica — trocar de aba de circunferência,
  // por exemplo, não deve recalcular dobras/cards/comparativo de novo.
  // Antes do early-return de "sem avaliações" de propósito (hooks não podem
  // ser condicionais).
  const cards = useMemo(() => buildResumoCards(assessments), [assessments]);
  const seriesDobras = useMemo(() => buildSeriesDobras(assessments), [assessments]);
  const somaDobras = useMemo(() => buildSerieSomaDobras(assessments), [assessments]);
  const seriesEvolucao = useMemo(
    () => METRICAS_EVOLUCAO.map((key) => METRICAS.find((m) => m.key === key)!).map((metric) => ({
      metric,
      pontos: buildSerieMetrica(assessments, metric),
    })),
    [assessments]
  );
  const grupoCirc = CIRCUMFERENCE_GROUPS[grupoCircIdx];
  const seriesCirc = useMemo(() => buildSeriesCircunferencia(assessments, grupoCirc), [assessments, grupoCirc]);

  const metricaAtiva = METRICAS.find((m) => m.key === metricaComparativo)!;
  const serieComparativo = useMemo(() => buildSerieMetrica(assessments, metricaAtiva), [assessments, metricaAtiva]);
  const comparativo = useMemo(
    () => calcularComparativo(serieComparativo, modoComparativo, metricaAtiva.unidade),
    [serieComparativo, modoComparativo, metricaAtiva]
  );

  const temDobras = useMemo(() => assessments.some((a) => a.protocol === 'skinfold'), [assessments]);

  if (assessments.length === 0) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="cli-detail-panel pad-panel" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2 style={{ marginBottom: 0 }}>Evolução Física</h2>
            <button className="modal-close" onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
          <div className="pad-empty">Este aluno ainda não possui avaliações físicas registradas.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel pad-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>Evolução Física</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {/* Seção 1 — Resumo */}
        <section className="pad-section">
          <div className="pad-cards-grid">
            {cards.map((c) => (
              <div key={c.key} className="pad-card">
                <div className="pad-card-label">{c.label}</div>
                <div className="pad-card-valor">{c.valor != null ? formatarValor(c.valor, c.unidade) : '—'}</div>
                {c.dataFonte && <div className="pad-card-data">{formatarDataCurta(c.dataFonte)}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Seção nova — Evolução da Avaliação (2 ou 3 avaliações escolhidas) */}
        <EvolucaoAvaliacaoSection assessments={assessments} />

        {/* Seção 2 — Evolução */}
        <section className="pad-section">
          <h3 className="pad-section-title">Evolução</h3>
          {seriesEvolucao.map(({ metric, pontos }) => (
            <GraficoLinha key={metric.key} titulo={metric.label} unidade={metric.unidade} pontos={pontos} />
          ))}
        </section>

        {/* Seção 3 — Circunferências */}
        <section className="pad-section">
          <h3 className="pad-section-title">Circunferências</h3>
          <div className="pad-selector-row">
            {CIRCUMFERENCE_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                className={`pad-chip${i === grupoCircIdx ? ' active' : ''}`}
                onClick={() => setGrupoCircIdx(i)}
              >
                {g.label}
              </button>
            ))}
          </div>
          <GraficoMultiSerie titulo={grupoCirc.label} unidade="cm" series={seriesCirc} />
        </section>

        {/* Seção 4 — Dobras cutâneas */}
        {temDobras && (
          <section className="pad-section">
            <h3 className="pad-section-title">Dobras cutâneas</h3>
            <div className="pad-selector-row">
              {seriesDobras.map((s, i) => (
                <button
                  key={s.site}
                  type="button"
                  className={`pad-chip${i === siteDobraIdx ? ' active' : ''}`}
                  onClick={() => setSiteDobraIdx(i)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <GraficoLinha titulo={seriesDobras[siteDobraIdx].label} unidade="mm" pontos={seriesDobras[siteDobraIdx].pontos} />
            <GraficoLinha titulo="Soma das 7 dobras" unidade="mm" pontos={somaDobras} />
          </section>
        )}

        {/* Seção 5 — Comparativo */}
        <section className="pad-section">
          <h3 className="pad-section-title">Comparativo</h3>
          <div className="pad-selector-row">
            {METRICAS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`pad-chip${m.key === metricaComparativo ? ' active' : ''}`}
                onClick={() => setMetricaComparativo(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="pad-toggle-row">
            <button
              type="button"
              className={`pad-toggle-opt${modoComparativo === 'primeira-atual' ? ' active' : ''}`}
              onClick={() => setModoComparativo('primeira-atual')}
            >
              Primeira × Atual
            </button>
            <button
              type="button"
              className={`pad-toggle-opt${modoComparativo === 'anterior-atual' ? ' active' : ''}`}
              onClick={() => setModoComparativo('anterior-atual')}
            >
              Anterior × Atual
            </button>
          </div>

          {comparativo ? (
            <div className="pad-comparativo-card">
              <div className="pad-comparativo-row">
                <span>Valor inicial</span>
                <strong>{formatarValor(comparativo.valorInicial, comparativo.unidade)}</strong>
              </div>
              <div className="pad-comparativo-row">
                <span>Valor atual</span>
                <strong>{formatarValor(comparativo.valorAtual, comparativo.unidade)}</strong>
              </div>
              <div className="pad-comparativo-row">
                <span>Diferença</span>
                <strong>{formatarDiferenca(comparativo.diferenca, comparativo.unidadeDiferenca)}</strong>
              </div>
              <div className="pad-comparativo-row">
                <span>Variação percentual</span>
                <strong>{formatarVariacaoPercentual(comparativo.variacaoPercentual)}</strong>
              </div>
            </div>
          ) : (
            <div className="pad-chart-empty">Precisa de pelo menos 2 avaliações com essa métrica pra comparar.</div>
          )}
        </section>

        {/* Seção 6 — Fotos Comparativas */}
        <section className="pad-section">
          <h3 className="pad-section-title">Fotos Comparativas</h3>
          <div className="pad-fotos-row">
            {(() => {
              const porDataAsc = [...assessments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              const ultima = porDataAsc[porDataAsc.length - 1];
              const anterior = porDataAsc[porDataAsc.length - 2] ?? ultima;
              return (
                <>
                  <MiniaturasFotos assessment={anterior} />
                  <MiniaturasFotos assessment={ultima} />
                </>
              );
            })()}
          </div>
          {assessments.length >= 2 && onComparar && (
            <button type="button" className="btn btn-ghost pad-comparar-btn" onClick={onComparar}>
              ⇄ Comparar fotos
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
