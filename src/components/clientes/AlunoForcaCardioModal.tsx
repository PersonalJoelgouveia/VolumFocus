import { useState } from 'react';
import { ForcaContent } from '../../views/ForcaView';
import { CardioTestPanel } from '../cardio/CardioTestPanel';
import { CardioHistoryCard } from '../cardio/CardioHistoryCard';
import { AlunoCardioSemanaCard } from './AlunoCardioSemanaCard';
import '../cardio/CardioView.css';
import { TestesComparativoDashboard } from '../saude/TestesComparativoDashboard';
import { PersonalAlunoTestesProvider } from '../testes/TestesScopeProviders';
import { useTestesScopeStatus } from '../testes/testesScope';
import { calcularIdade } from '../../types/aluno';
import type { Aluno } from '../../types/aluno';
import '../shared/ConsistencyGridCard.css';
import './ClientesView.css';

type Sub = 'forca' | 'cardio';

function Conteudo({ sub, alunoEmail }: { sub: Sub; alunoEmail: string }) {
  const { loading, error } = useTestesScopeStatus();
  return (
    <>
      {loading && <div className="cli-ex-detail" style={{ margin: '8px 0' }}>Carregando testes do aluno…</div>}
      {error && <div className="cli-ex-detail" style={{ margin: '8px 0', color: 'var(--red)' }}>Não foi possível carregar os testes salvos deste aluno. Verifique a conexão.</div>}
      {sub === 'forca' ? (
        <>
          <div className="perf-panel active"><ForcaContent /></div>
          <TestesComparativoDashboard tipo="forca" />
        </>
      ) : (
        <>
          {/* Sem CardioContent: Meta Semanal/Sessões vêm do aparelho do Personal. Aqui só dados DO ALUNO. */}
          <div className="perf-panel active">
            <AlunoCardioSemanaCard alunoEmail={alunoEmail} />
            <CardioTestPanel />
            <CardioHistoryCard />
          </div>
          <TestesComparativoDashboard tipo="cardio" />
        </>
      )}
    </>
  );
}

/**
 * Força 1RM e Cardiorrespiratório DE UM ALUNO, registrados pelo Personal. Reaproveita os mesmos
 * componentes de teste: o PersonalAlunoTestesProvider troca a origem dos dados (nuvem do aluno, não
 * os testes do próprio Personal). O aluno enxerga estes resultados em Saúde > Avaliação Física e a
 * Carga Alvo dos exercícios dele passa a usá-los.
 */
export function AlunoForcaCardioModal({ aluno, onClose }: { aluno: Aluno; onClose: () => void }) {
  const [sub, setSub] = useState<Sub>('forca');
  const idade = calcularIdade(aluno.dataNascimento);
  const g = (aluno.genero ?? '').trim().charAt(0).toUpperCase();
  const perfil = { gender: g === 'F' ? ('F' as const) : g === 'M' ? ('M' as const) : undefined, age: idade ?? undefined };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel af-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ marginBottom: 0 }}>💪 Força &amp; Cardio — {aluno.nome}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="cli-ex-detail" style={{ marginBottom: 8 }}>
          Os testes registrados aqui pertencem a este aluno (não aos seus) e ficam visíveis para ele.
        </div>
        <div className="perf-tabs" role="tablist" aria-label="Testes do aluno">
          <button type="button" role="tab" aria-selected={sub === 'forca'} className={`perf-tab${sub === 'forca' ? ' active' : ''}`} onClick={() => setSub('forca')}>
            Força 1RM
          </button>
          <button type="button" role="tab" aria-selected={sub === 'cardio'} className={`perf-tab${sub === 'cardio' ? ' active' : ''}`} onClick={() => setSub('cardio')}>
            Cardiorrespiratório
          </button>
        </div>
        <PersonalAlunoTestesProvider alunoEmail={aluno.email} perfil={perfil}>
          <Conteudo sub={sub} alunoEmail={aluno.email} />
        </PersonalAlunoTestesProvider>
      </div>
    </div>
  );
}
