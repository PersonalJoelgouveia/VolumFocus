import { useState } from 'react';
import { resumirRotina } from '../../utils/resumoRotina';
import { agruparTreinosDaSemana } from '../../utils/agruparTreinos';
import { DAYS_SHORT } from '../../types/workout';
import type { AlunoRotinaSalva } from '../../types/aluno';
import { RotinaSemanaLeitura } from './RotinaSemanaLeitura';
import { RotinaTreinosLeitura } from './RotinaTreinosLeitura';
import './RotinasModal.css';
import './MinhasRotinasSection.css';

export function dataCurta(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

/** Card compacto de uma rotina (nome, selo "Atual", dias/exercícios, data, siglas dos dias). */
export function CartaoRotina({ rotina, onAbrir }: { rotina: AlunoRotinaSalva; onAbrir: () => void }) {
  const { diasComTreino, totalExercicios } = resumirRotina(rotina.rotina);
  const nTreinos = agruparTreinosDaSemana(rotina.rotina).treinos.length;
  return (
    <button className={`mrs-card${rotina.ativa ? ' mrs-card-ativa' : ''}`} onClick={onAbrir}>
      <div className="mrs-card-top">
        <span className="mrs-card-nome">{rotina.nome}</span>
        {rotina.ativa && <span className="mrs-badge">Atual</span>}
      </div>
      <div className="routine-meta">
        {nTreinos} treino{nTreinos === 1 ? '' : 's'} · {diasComTreino.length} dia{diasComTreino.length === 1 ? '' : 's'}/sem · {totalExercicios} ex.
        {rotina.atualizadaEm && ` · ${dataCurta(rotina.atualizadaEm)}`}
      </div>
      {diasComTreino.length > 0 && (
        <div className="mrs-pills">
          {diasComTreino.map((d) => (
            <span className="routine-day-pill" key={d}>
              {DAYS_SHORT[d]}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/** Lista de cartões: só a rotina atual + botão para ver o histórico (evita rolagem longa). */
export function ListaCartoesRotina({ rotinas, onAbrir }: { rotinas: readonly AlunoRotinaSalva[]; onAbrir: (id: string) => void }) {
  const [todas, setTodas] = useState(false);
  const visiveis = todas ? rotinas : rotinas.slice(0, 1);
  const ocultas = rotinas.length - 1;
  return (
    <>
      <div className="mrs-list">
        {visiveis.map((r) => (
          <CartaoRotina key={r.id} rotina={r} onAbrir={() => onAbrir(r.id)} />
        ))}
      </div>
      {ocultas > 0 && (
        <button className="btn btn-ghost btn-sm btn-full mrs-mais" onClick={() => setTodas((v) => !v)} aria-expanded={todas}>
          {todas ? 'Ocultar histórico' : `Ver histórico (${ocultas} anterior${ocultas === 1 ? '' : 'es'})`}
        </button>
      )}
    </>
  );
}

/** Detalhe SOMENTE LEITURA de uma rotina (semana completa) + botões de voltar. Nunca grava nada. */
export function DetalheRotinaLeitura({
  rotina,
  onVoltar,
  onEditar,
}: {
  rotina: AlunoRotinaSalva;
  onVoltar: () => void;
  /** Só o Personal passa isto: carrega a rotina no editor (a publicação cria uma NOVA versão). */
  onEditar?: () => void;
}) {
  const { diasComTreino, totalExercicios } = resumirRotina(rotina.rotina);
  const [semanaCompleta, setSemanaCompleta] = useState(false);
  return (
    <>
      <button className="btn btn-ghost btn-sm mrs-voltar" onClick={onVoltar}>
        ← Voltar às rotinas
      </button>
      <div className="mrs-detalhe-head">
        <div className="mrs-detalhe-nome">{rotina.nome}</div>
        {rotina.ativa && <span className="mrs-badge">Atual</span>}
      </div>
      <div className="routine-meta">
        {diasComTreino.length} dia{diasComTreino.length === 1 ? '' : 's'} de treino · {totalExercicios} exercícios
        {rotina.atualizadaEm && ` · atualizada em ${dataCurta(rotina.atualizadaEm)}`}
      </div>
      <p className="mrs-readonly">Somente leitura — abrir não altera o treino da semana.</p>
      {onEditar && (
        <>
          <button className="btn btn-primary btn-sm btn-full" onClick={onEditar}>
            ✎ Editar esta rotina
          </button>
          <p className="mrs-readonly">
            Abre no editor como rascunho. Ao usar "Salvar &amp; Publicar", é criada uma nova rotina atual e esta fica no histórico.
          </p>
        </>
      )}
      {semanaCompleta ? (
        <RotinaSemanaLeitura key={rotina.id} rotina={rotina.rotina} />
      ) : (
        <RotinaTreinosLeitura key={rotina.id} rotina={rotina.rotina} />
      )}
      <button className="btn btn-ghost btn-sm btn-full mrs-toggle-semana" onClick={() => setSemanaCompleta((v) => !v)}>
        {semanaCompleta ? 'Ver só os treinos (A, B, C…)' : 'Ver semana completa (7 dias)'}
      </button>
    </>
  );
}
