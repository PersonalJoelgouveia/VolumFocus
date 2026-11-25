import { useEffect, useState } from 'react';
import { listarResumosCardio } from '../../lib/cardioSemanalRepository';
import { semanaId } from '../../utils/cardioSemanalAluno';
import type { ResumoCardioSemanal } from '../../utils/cardioSemanalAluno';
import '../cardio/CardioView.css';

type Estado = { status: 'loading' } | { status: 'error' } | { status: 'ok'; semanas: ResumoCardioSemanal[] };

function fmtSemana(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Cardio REAL do aluno (resumo que o app dele envia), visto pelo Personal no perfil do cliente.
 * Dado só em memória; a meta exibida é a do próprio aluno — a do Personal fica no dashboard dele.
 */
export function AlunoCardioSemanaCard({ alunoEmail }: { alunoEmail: string }) {
  const [estado, setEstado] = useState<Estado>({ status: 'loading' });

  useEffect(() => {
    let vivo = true;
    setEstado({ status: 'loading' });
    listarResumosCardio(alunoEmail, 6)
      .then((semanas) => vivo && setEstado({ status: 'ok', semanas }))
      .catch((e) => {
        console.warn('AlunoCardioSemanaCard: falha ao ler o cardio do aluno', e);
        if (vivo) setEstado({ status: 'error' });
      });
    return () => {
      vivo = false;
    };
  }, [alunoEmail]);

  const atualId = semanaId();
  const semanas = estado.status === 'ok' ? estado.semanas : [];
  const atual = semanas.find((s) => s.semana === atualId);
  const anteriores = semanas.filter((s) => s.semana !== atualId);
  const pct = atual && atual.metaMin > 0 ? Math.min(100, (atual.totalMin / atual.metaMin) * 100) : 0;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title">🏃 Cardio do aluno · Esta semana</div>
      {estado.status === 'loading' && <div className="cardio-empty">Carregando…</div>}
      {estado.status === 'error' && (
        <div className="cardio-empty">Não foi possível carregar o cardio do aluno agora. Tente novamente mais tarde.</div>
      )}
      {estado.status === 'ok' && !atual && (
        <div className="cardio-empty">
          Sem cardio recebido desta semana. O resumo chega quando o aluno abre o app e registra cardio.
        </div>
      )}
      {atual && (
        <>
          <div className="cardio-goal-row">
            <div>
              <span className="cardio-goal-value">{atual.totalMin}</span>
              <span className="cardio-goal-of"> / {atual.metaMin} min (meta do aluno)</span>
            </div>
          </div>
          <div className="cardio-progress-track">
            <div
              className={`cardio-progress-fill${atual.totalMin >= atual.metaMin && atual.metaMin > 0 ? ' cardio-progress-done' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {atual.sessoes.length === 0 ? (
            <div className="cardio-empty">Nenhuma sessão registrada.</div>
          ) : (
            <div className="cardio-hist-list" style={{ marginTop: 10 }}>
              {atual.sessoes.map((s, i) => (
                <div className="cardio-hist-item" key={i}>
                  <div className="cardio-hist-item-left">
                    <span className="cardio-hist-vo2" style={{ fontSize: '0.7rem' }}>{s.dia}</span>
                    <div>
                      <div>{s.nome}</div>
                      <div className="cardio-hist-date">
                        {s.duracao} min · Intensidade {s.intensidade}/10
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="cardio-hist-date" style={{ marginTop: 8 }}>
            Atualizado em {new Date(atual.atualizadoEm).toLocaleString('pt-BR')}
          </div>
        </>
      )}
      {anteriores.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="cardio-hist-date" style={{ marginBottom: 6 }}>Semanas anteriores</div>
          <div className="cardio-hist-list">
            {anteriores.map((s) => (
              <div className="cardio-hist-item" key={s.semana}>
                <span>Semana de {fmtSemana(s.semana)}</span>
                <span className="cardio-hist-vo2">
                  {s.totalMin} / {s.metaMin} min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
