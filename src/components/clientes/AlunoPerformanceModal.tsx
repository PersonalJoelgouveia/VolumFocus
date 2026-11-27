import { useEffect, useMemo, useState } from 'react';
import type { Aluno } from '../../types/aluno';
import { listarSemanas } from '../../lib/performanceRepository';
import { useExerciseStore } from '../../store/useExerciseStore';
import { ConsistencyGridCard } from '../shared/ConsistencyGridCard';
import type { CgridSource } from '../shared/ConsistencyGridCard';
import { XRayContent } from '../../views/DashboardView';
import { AlunoDiaDetalhe } from './AlunoDiaDetalhe';
import { dateKey, formatWeekRange, isCurrentWeek, mondayOf, weekAndDayOf } from '../../utils/retroWeek';
import type { SemanaDoc } from '../../utils/performanceSync';
import type { Exercise } from '../../types/exercise';
import '../shared/ConsistencyGridCard.css';
import '../cardio/CardioView.css';

type Estado = { status: 'loading' } | { status: 'error' } | { status: 'ok'; semanas: SemanaDoc[] };

const DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/**
 * Performance e Histórico do ALUNO, visto pelo Personal dono: mesmo grid de consistência e mesmo X-ray do
 * menu Performance do cliente, alimentados pelas semanas que o app do aluno publicou. Somente leitura;
 * dados só em memória (nada é salvo no aparelho do Personal).
 */
export function AlunoPerformanceModal({ aluno, onClose }: { aluno: Aluno; onClose: () => void }) {
  const [estado, setEstado] = useState<Estado>({ status: 'loading' });
  const [dataSel, setDataSel] = useState<string | null>(null);
  const [semanaXray, setSemanaXray] = useState<string | null>(null);
  const exerciciosPT = useExerciseStore((s) => s.exercises);

  useEffect(() => {
    let vivo = true;
    setEstado({ status: 'loading' });
    listarSemanas(aluno.email)
      .then((semanas) => vivo && setEstado({ status: 'ok', semanas }))
      .catch((e) => {
        console.warn('AlunoPerformanceModal: falha ao ler a performance do aluno', e);
        if (vivo) setEstado({ status: 'error' });
      });
    return () => {
      vivo = false;
    };
  }, [aluno.email]);

  const semanas = estado.status === 'ok' ? estado.semanas : [];
  const porChave = useMemo(() => new Map(semanas.map((s) => [s.semana, s])), [semanas]);

  // Exercícios: os do ALUNO (podem ser personalizados) primeiro; os do Personal só completam o que faltar.
  const exercicios = useMemo<Exercise[]>(() => {
    const mapa = new Map<string, Exercise>();
    semanas.forEach((s) =>
      s.exercicios.forEach((x) => {
        if (!mapa.has(x.id)) mapa.set(x.id, { ...x, synergist: x.synergist, stabilizer: x.stabilizer } as unknown as Exercise);
      })
    );
    exerciciosPT.forEach((x) => {
      if (!mapa.has(x.id)) mapa.set(x.id, x);
    });
    return [...mapa.values()];
  }, [semanas, exerciciosPT]);

  const source = useMemo<CgridSource>(() => {
    const atualKey = dateKey(mondayOf(new Date()));
    const atual = porChave.get(atualKey);
    const retro: CgridSource['retro'] = {};
    semanas.forEach((s) => {
      if (s.semana !== atualKey) retro[s.semana] = { weekLog: s.weekLog, weekPSE: s.weekPSE as never, exDone: s.exDone ?? ({} as never) };
    });
    return { weekLog: atual?.weekLog ?? {}, exDone: atual?.exDone ?? ({} as never), historico: [], retro, exercises: exercicios };
  }, [porChave, semanas, exercicios]);

  // Semana exibida no X-ray: a do dia clicado; senão a mais recente com treino.
  const chaveSel = dataSel ? weekAndDayOf(parseData(dataSel)).key : null;
  const chaveXray = semanaXray ?? chaveSel ?? semanas[0]?.semana ?? null;
  const semanaXrayDoc = chaveXray ? porChave.get(chaveXray) : undefined;
  const idx = chaveXray ? semanas.findIndex((s) => s.semana === chaveXray) : -1;

  function selecionarData(d: string) {
    setDataSel(d);
    setSemanaXray(null);
  }
  const sel = dataSel ? weekAndDayOf(parseData(dataSel)) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 2 }}>📈 Performance e Histórico — {aluno.nome}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="cli-detail-sub" style={{ marginBottom: 10 }}>
          Dados publicados pelo app do aluno (semana atual, histórico e treinos retroativos). Somente leitura.
        </div>

        {estado.status === 'loading' && <div className="cardio-empty">Carregando…</div>}
        {estado.status === 'error' && (
          <div className="cardio-empty">Não foi possível carregar a performance do aluno agora. Tente novamente mais tarde.</div>
        )}
        {estado.status === 'ok' && semanas.length === 0 && (
          <div className="cardio-empty">
            Nenhum treino recebido deste aluno ainda. Os dados chegam quando ele abre a versão mais recente do app e tem treinos
            registrados.
          </div>
        )}

        {estado.status === 'ok' && semanas.length > 0 && (
          <>
            <ConsistencyGridCard source={source} onSelectDate={selecionarData} selectedDate={dataSel} />

            {sel && (
              <AlunoDiaDetalhe
                semana={porChave.get(sel.key)}
                dia={sel.day}
                rotulo={`${DIAS[sel.day]} · ${parseData(dataSel as string).toLocaleDateString('pt-BR')}`}
                exercicios={porChave.get(sel.key)?.exercicios ?? exercicios}
              />
            )}

            <div className="sec-row" style={{ marginTop: 20 }}>
              <div className="page-title">
                X-ray <span className="tag">{chaveXray ? formatWeekRange(chaveXray) : '—'}</span>
                {chaveXray && isCurrentWeek(chaveXray) && <span className="tag">SEMANA ATUAL</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={idx < 0 || idx >= semanas.length - 1}
                  onClick={() => setSemanaXray(semanas[idx + 1].semana)}
                >
                  ‹ Anterior
                </button>
                <button className="btn btn-ghost btn-sm" disabled={idx <= 0} onClick={() => setSemanaXray(semanas[idx - 1].semana)}>
                  Próxima ›
                </button>
              </div>
            </div>
            <XRayContent weekLog={semanaXrayDoc?.weekLog ?? {}} exercises={exercicios} />
          </>
        )}
      </div>
    </div>
  );
}

function parseData(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
