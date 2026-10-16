import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import type { PhysicalAssessment } from '../../types/assessment';
import { formatarDiferenca, formatarValor } from '../../utils/assessmentDashboard';
import { montarRelatorio, tituloDoPdf } from '../../utils/relatorioAvaliacao';
import { SKINFOLD_SITE_LABELS, type SkinfoldSite } from '../../utils/pollock7';
import { formatarDataCurta } from '../../utils/timelineDate';
import { PHOTO_POSES, getPhotoObjectUrl, type PhotoPose } from '../../lib/assessmentPhotoStore';
import './RelatorioAvaliacao.css';

const POSE_LABEL: Record<PhotoPose, string> = { front: 'Frente', back: 'Costas', rightSide: 'Lado direito', leftSide: 'Lado esquerdo' };
const PROTOCOLO: Record<string, string> = { skinfold: 'Dobras cutâneas', bioimpedance: 'Bioimpedância', online: 'Online (autoavaliação)', custom: 'Personalizada' };

interface Props {
  nome: string;
  avaliacaoId: string;
  assessments: PhysicalAssessment[];
  onClose: () => void;
  /** Disparado ao imprimir/salvar PDF (usado para a trilha do link). */
  onPrint?: () => void;
  /** Fotos comparativas: só no aparelho que as tem (IndexedDB local) e só se o uso de imagem estiver liberado. */
  fotos?: { alunoId: string; liberado: boolean };
  /** Slot extra na barra de ferramentas (ex.: painel de compartilhamento — fora da impressão). */
  barra?: ReactNode;
}

function FotoPar({ alunoId, avaliacaoId, anteriorId }: { alunoId: string; avaliacaoId: string; anteriorId: string | null }) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let vivo = true;
    const criadas: string[] = [];
    (async () => {
      const out: Record<string, string | null> = {};
      for (const pose of PHOTO_POSES) {
        for (const [tag, id] of [['a', anteriorId], ['b', avaliacaoId]] as const) {
          if (!id) continue;
          const u = await getPhotoObjectUrl(alunoId, id, pose).catch(() => null);
          if (u) criadas.push(u);
          out[`${tag}-${pose}`] = u;
        }
      }
      if (vivo) setUrls(out);
    })();
    return () => {
      vivo = false;
      criadas.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [alunoId, avaliacaoId, anteriorId]);
  const poses = PHOTO_POSES.filter((p) => urls[`a-${p}`] || urls[`b-${p}`]);
  if (poses.length === 0) return <p className="rel-vazio">Nenhuma foto neste aparelho para esta avaliação.</p>;
  return (
    <div className="rel-fotos">
      {poses.map((p) => (
        <div key={p} className="rel-foto-linha">
          <div className="rel-foto-pose">{POSE_LABEL[p]}</div>
          {anteriorId && <div className="rel-foto">{urls[`a-${p}`] ? <img src={urls[`a-${p}`]!} alt={`${POSE_LABEL[p]} — anterior`} /> : <span>—</span>}<small>Anterior</small></div>}
          <div className="rel-foto">{urls[`b-${p}`] ? <img src={urls[`b-${p}`]!} alt={`${POSE_LABEL[p]} — atual`} /> : <span>—</span>}<small>Atual</small></div>
        </div>
      ))}
    </div>
  );
}

/**
 * Relatório de avaliação para impressão / "Salvar como PDF" do navegador. PDF gerado NO APARELHO a partir de
 * dados já carregados (sem arquivo em servidor, sem URL pública). Renderizado num portal direto no <body>;
 * o CSS de impressão esconde o resto do app. Nenhum dado é gravado em storage do navegador.
 */
export function RelatorioAvaliacao({ nome, avaliacaoId, assessments, onClose, onPrint, fotos, barra }: Props) {
  const dados = useMemo(() => montarRelatorio(assessments, avaliacaoId), [assessments, avaliacaoId]);
  const [comFotos, setComFotos] = useState(false);
  const geradoEm = useMemo(() => new Date(), []);

  useEffect(() => {
    document.body.classList.add('rel-printing');
    return () => document.body.classList.remove('rel-printing');
  }, []);

  function imprimir() {
    if (!dados) return;
    const tituloAntes = document.title;
    document.title = tituloDoPdf(dados.atual.date);
    const restaurar = () => {
      document.title = tituloAntes;
      window.removeEventListener('afterprint', restaurar);
    };
    window.addEventListener('afterprint', restaurar);
    onPrint?.();
    window.print();
  }

  const conteudo = !dados ? (
    <div className="rel-doc">
      <p>Avaliação não encontrada.</p>
    </div>
  ) : (
    <div className="rel-doc">
      <header className="rel-cab">
        <h1>Relatório de Avaliação Física</h1>
        <div className="rel-cab-grid">
          <div><span>Aluno</span><strong>{nome || '—'}</strong></div>
          <div><span>Data da avaliação</span><strong>{formatarDataCurta(dados.atual.date)}</strong></div>
          <div><span>Protocolo</span><strong>{PROTOCOLO[dados.atual.protocol] ?? dados.atual.protocol}</strong></div>
          {dados.atual.evaluator && <div><span>Avaliador</span><strong>{dados.atual.evaluator}</strong></div>}
          <div><span>Comparada com</span><strong>{dados.anterior ? formatarDataCurta(dados.anterior.date) : 'primeira avaliação'}</strong></div>
          <div><span>Relatório gerado em</span><strong>{geradoEm.toLocaleString('pt-BR')}</strong></div>
          <div><span>Referência</span><strong>{avaliacaoId.slice(0, 8)}</strong></div>
        </div>
      </header>

      <section>
        <h2>Resumo e comparação</h2>
        <table className="rel-tab">
          <thead>
            <tr><th>Medida</th><th>Atual</th><th>Anterior</th><th>Δ anterior</th><th>Δ desde a 1ª</th></tr>
          </thead>
          <tbody>
            {dados.metricas.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td><strong>{formatarValor(m.atual, m.unidade)}</strong></td>
                <td>{m.anterior != null ? formatarValor(m.anterior, m.unidade) : '—'}</td>
                <td>{m.difAnterior != null ? formatarDiferenca(m.difAnterior, m.unidadeDif) : '—'}</td>
                <td>{m.difPrimeira != null ? formatarDiferenca(m.difPrimeira, m.unidadeDif) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {dados.composicao && (
        <section className="rel-nobreak">
          <h2>Composição corporal</h2>
          <div className="rel-barra" role="img" aria-label={`Massa magra ${dados.composicao.magra.toFixed(1)}%, gordura ${dados.composicao.gordura.toFixed(1)}%`}>
            <div className="rel-barra-magra" style={{ width: `${Math.max(0, Math.min(100, dados.composicao.magra))}%` }}>Massa magra {dados.composicao.magra.toFixed(1)}%</div>
            <div className="rel-barra-gordura" style={{ width: `${Math.max(0, Math.min(100, dados.composicao.gordura))}%` }}>Gordura {dados.composicao.gordura.toFixed(1)}%</div>
          </div>
        </section>
      )}

      {dados.evolucao.some((e) => e.pontos.length > 1) && (
        <section>
          <h2>Evolução</h2>
          <div className="rel-graficos">
            {dados.evolucao.filter((e) => e.pontos.length > 1).map((e) => (
              <div key={e.key} className="rel-grafico rel-nobreak">
                <div className="rel-grafico-t">{e.label}{e.unidade ? ` (${e.unidade})` : ''}</div>
                <LineChart width={330} height={150} data={e.pontos.map((p) => ({ d: formatarDataCurta(p.date), v: p.valor }))} margin={{ top: 6, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#d9d9d9" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 9, fill: '#444' }} />
                  <YAxis tick={{ fontSize: 9, fill: '#444' }} domain={['auto', 'auto']} width={40} />
                  <Line type="monotone" dataKey="v" stroke="#0b7a75" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
                </LineChart>
              </div>
            ))}
          </div>
        </section>
      )}

      {dados.circunferencias.length > 0 && (
        <section className="rel-nobreak">
          <h2>Circunferências (cm)</h2>
          <table className="rel-tab">
            <thead><tr><th>Medida</th><th>Atual</th><th>Anterior</th><th>Δ</th></tr></thead>
            <tbody>
              {dados.circunferencias.map((c, i) => (
                <tr key={`${c.nome}-${c.lado}-${i}`}>
                  <td>{c.nome}{c.lado ? ` (${c.lado})` : ''}</td>
                  <td><strong>{c.atual.toFixed(1)}</strong></td>
                  <td>{c.anterior != null ? c.anterior.toFixed(1) : '—'}</td>
                  <td>{c.dif != null ? formatarDiferenca(c.dif, 'cm') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {dados.dobras.length > 0 && (
        <section className="rel-nobreak">
          <h2>Dobras cutâneas (mm, média)</h2>
          <table className="rel-tab">
            <thead><tr><th>Ponto</th><th>Atual</th><th>Anterior</th></tr></thead>
            <tbody>
              {dados.dobras.map((d) => (
                <tr key={d.site}>
                  <td>{SKINFOLD_SITE_LABELS[d.site as SkinfoldSite] ?? d.site}</td>
                  <td><strong>{d.atual.toFixed(2)}</strong></td>
                  <td>{d.anterior != null ? d.anterior.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {comFotos && fotos?.liberado && (
        <section>
          <h2>Fotos comparativas</h2>
          <FotoPar alunoId={fotos.alunoId} avaliacaoId={avaliacaoId} anteriorId={dados.anterior?.id ?? null} />
        </section>
      )}

      <footer className="rel-rodape">
        Documento confidencial com dados pessoais de saúde, destinado ao aluno e ao Personal Trainer responsável.
        Não compartilhe em canais abertos. Medidas de acompanhamento de treino — não constituem diagnóstico médico.
      </footer>
    </div>
  );

  return createPortal(
    <div className="rel-overlay" role="dialog" aria-label="Relatório de avaliação física">
      <div className="rel-toolbar">
        <button type="button" className="btn btn-primary" onClick={imprimir} disabled={!dados}>Imprimir / Salvar PDF</button>
        {fotos?.liberado && (
          <label className="rel-check">
            <input type="checkbox" checked={comFotos} onChange={(e) => setComFotos(e.target.checked)} /> Incluir fotos (só deste aparelho)
          </label>
        )}
        {barra}
        <button type="button" className="btn btn-ghost" onClick={onClose}>Fechar</button>
      </div>
      {conteudo}
    </div>,
    document.body
  );
}
