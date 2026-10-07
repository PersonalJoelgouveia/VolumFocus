import { useEffect, useRef, useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { GROUP_LABELS } from '../../types/workout';
import { calcularIdade, iniciais, isAlunoExercicioCardio } from '../../types/aluno';
import type { AlunoExercicio } from '../../types/aluno';
import { buildGroupedRows } from '../../utils/dayLogGrouping';
import { deletePhotosByAluno } from '../../lib/assessmentPhotoStore';
import { deletePersonalVideosByCliente } from '../../lib/localVideoStore';
import { limparRascunhoOnline } from '../../lib/onlineAssessmentDraftStore';
import { useSessionStore } from '../../store/useSessionStore';
import { iniciarSessaoComRotina } from '../../lib/iniciarSessaoComRotina';
import { useAuthStore } from '../../store/useAuthStore';
import { ErrorBoundary } from '../ErrorBoundary';
import { AvaliacaoFisicaModal } from './AvaliacaoFisicaModal';
import './ClientesView.css';

interface AlunoDetailModalProps {
  alunoId: string;
  onClose: () => void;
  onEditPerfil: () => void;
  onEditarRotina: (day: number) => void;
}

import '../registro/MinhasRotinasSection.css';
import { RotinasDoAlunoSection } from './RotinasDoAlunoSection';
import { selectRotinasDoAluno, useRotinasDoAlunoStore } from '../../store/useRotinasDoAlunoStore';
import { rotinaSemExercicios } from '../../utils/resumoRotina';
import { agruparTreinosDaSemana, formatarDias } from '../../utils/agruparTreinos';
import type { AlunoRotinaSalva } from '../../types/aluno';
/**
 * Sucessor de #modal-cli-aluno (cli_openAluno/cli_renderMiniPerfil/
 * cli_renderDaysBar/cli_renderDayContent, index.html ~10603-10716):
 * mini-perfil colapsável + barra de dias + lista de exercícios do dia
 * selecionado, somente leitura. "Editar Rotina" abre o RoutineEditorModal
 * no mesmo dia.
 */
export function AlunoDetailModal({ alunoId, onClose, onEditPerfil, onEditarRotina }: AlunoDetailModalProps) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const removeAluno = useAlunoStore((s) => s.removeAluno);
  const showToast = useUIStore((s) => s.showToast);

  const initialDay = aluno?.rotina.findIndex((d) => d.exercicios.length > 0) ?? -1;
  const [activeDay, setActiveDay] = useState(initialDay >= 0 ? initialDay : 0);
  const setRotinaDia = useAlunoStore((s) => s.setRotinaDia);
  const rotinasNuvem = useRotinasDoAlunoStore(selectRotinasDoAluno(aluno?.email ?? ''));
  const hidratou = useRef(false);
  const [origemRascunho, setOrigemRascunho] = useState<string | null>(null);

  /** Copia a rotina da nuvem para o rascunho local de edição (a semana Seg–Dom abaixo). */
  function carregarNoRascunho(r: AlunoRotinaSalva) {
    const copia = JSON.parse(JSON.stringify(r.rotina)) as AlunoRotinaSalva['rotina'];
    copia.forEach((dia, d) => setRotinaDia(alunoId, d, dia));
    setOrigemRascunho(r.nome);
    const primeiro = copia.findIndex((d) => d.exercicios.length > 0);
    setActiveDay(primeiro >= 0 ? primeiro : 0);
  }

  // A semana abaixo é o rascunho local; se ele ainda está EM BRANCO e o aluno tem rotina
  // atual na nuvem, mostra essa rotina (uma vez por abertura — nunca sobrescreve rascunho com conteúdo).
  useEffect(() => {
    if (hidratou.current || !aluno || rotinasNuvem.status !== 'pronto') return;
    hidratou.current = true;
    if (rotinasNuvem.ativa && rotinaSemExercicios(aluno.rotina)) carregarNoRascunho(rotinasNuvem.ativa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotinasNuvem.status]);

  async function handleEditarRotinaDaNuvem(r: AlunoRotinaSalva) {
    if (!aluno) return;
    if (!rotinaSemExercicios(aluno.rotina)) {
      const ok = await useConfirmStore.getState().ask(
        `Carregar "${r.nome}" no editor? O rascunho atual da semana de ${aluno.nome.split(' ')[0]} será substituído (a rotina publicada na nuvem não muda até você usar Salvar & Publicar).`,
        { confirmLabel: 'Carregar no Editor' }
      );
      if (!ok) return;
    }
    carregarNoRascunho(r);
    const primeiro = r.rotina.findIndex((d) => d.exercicios.length > 0);
    onEditarRotina(primeiro >= 0 ? primeiro : 0);
  }
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [avaliacaoOpen, setAvaliacaoOpen] = useState(false);

  if (!aluno) return null;

  const idade = calcularIdade(aluno.dataNascimento);
  const dia = aluno.rotina[activeDay];
  const { treinos, descanso } = agruparTreinosDaSemana(aluno.rotina);
  const treinoAtual = treinos.find((t) => t.dias.includes(activeDay));

  function handleExcluir() {
    useConfirmStore
      .getState()
      .ask(`Remover ${aluno!.nome} da lista de alunos? Serão apagados neste dispositivo: fotos, vídeos, rascunhos, sessão aberta e o cache de avaliações e anotações. Nada é apagado na nuvem, e o acesso do aluno ao app NÃO é revogado.`, {
        confirmLabel: 'Remover',
        danger: true,
      })
      .then((ok) => {
        if (!ok) return;
        void deletePhotosByAluno(aluno!.id).catch((e) =>
          console.error('AlunoDetailModal: falha ao apagar fotos locais do aluno', e)
        );
        const meuEmail = useAuthStore.getState().user?.email;
        if (meuEmail) {
          void deletePersonalVideosByCliente(meuEmail, aluno!.id).catch((e) =>
            console.error('AlunoDetailModal: falha ao apagar vídeos locais do aluno', e)
          );
        }
        limparRascunhoOnline(aluno!.id);
        const sessoes = useSessionStore.getState();
        sessoes.sessions.filter((s) => s.alunoId === aluno!.id).forEach((s) => sessoes.fecharSessao(s.id));
        removeAluno(aluno!.id);
        showToast('🗑️ Aluno removido', 'success');
        onClose();
      });
  }

  async function handleIniciarRotina() {
    if (rotinaSemExercicios(aluno!.rotina)) {
      showToast('⚠️ A rotina está vazia — monte ou carregue uma rotina antes de iniciar.', 'warning');
      return;
    }
    const existente = useSessionStore.getState().sessions.some((s) => s.alunoId === aluno!.id);
    if (existente) {
      const ok = await useConfirmStore.getState().ask(
        `${aluno!.nome.split(' ')[0]} já tem uma sessão aberta. Carregar esta rotina substitui a semana dessa sessão (progresso incluso).`,
        { confirmLabel: 'Substituir e Iniciar', danger: true }
      );
      if (!ok) return;
    }
    const r = iniciarSessaoComRotina(aluno!.id, aluno!.nome, aluno!.rotina);
    if (!r.ok) {
      showToast('⚠️ Limite de sessões simultâneas atingido. Encerre uma sessão para iniciar outra.', 'warning');
      return;
    }
    showToast(`✅ Sessão de ${aluno!.nome.split(' ')[0]} iniciada com a rotina carregada`, 'success');
    onClose();
  }

  function renderExItem(ex: AlunoExercicio, i: number) {
    return (
      <div className="cli-ex-item" key={i}>
        <div className="cli-ex-info">
          <div className="cli-ex-name" title={ex.nome}>
            {ex.nome}
          </div>
          <div className="cli-ex-detail">
            {isAlunoExercicioCardio(ex) ? (
              <>
                <span className="cli-ex-chip">{ex.duracao}</span>
                <span className="cli-ex-chip">Intensidade: {ex.intensidade}</span>
              </>
            ) : (
              <>
                <span className="cli-ex-chip">
                  {ex.series}×{ex.reps}
                </span>
                <span className="cli-ex-chip">{ex.carga}kg</span>
                {ex.sugestao && <span className="cli-ex-chip cli-ex-chip-sug">▲ {ex.sugestao}kg</span>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="cli-avatar">{iniciais(aluno.nome)}</div>
            <div>
              <h2 style={{ marginBottom: 2 }}>{aluno.nome}</h2>
              <div className="cli-detail-sub">
                {aluno.foco} · Último treino: {aluno.ultimoTreino ?? '—'}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <button className="cli-profile-toggle" onClick={() => setPerfilOpen((v) => !v)}>
          {perfilOpen ? '▲ Ocultar' : '▼ Ver'} mini-perfil
        </button>

        <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => setAvaliacaoOpen(true)}>
          📋 Avaliação Física
        </button>

        {perfilOpen && (
          <div className="cli-profile-grid">
            <div className="cli-profile-item full">
              <div className="cli-profile-label">E-mail</div>
              <div className="cli-profile-value">{aluno.email}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">Idade</div>
              <div className={`cli-profile-value${idade == null ? ' empty' : ''}`}>{idade != null ? `${idade} anos` : '—'}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">WhatsApp</div>
              <div className={`cli-profile-value${aluno.telefone ? '' : ' empty'}`}>{aluno.telefone || '—'}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">Gênero</div>
              <div className={`cli-profile-value${aluno.genero ? '' : ' empty'}`}>{aluno.genero || '—'}</div>
            </div>
            <div className="cli-profile-item">
              <div className="cli-profile-label">Objetivo</div>
              <div className={`cli-profile-value${aluno.objetivo ? '' : ' empty'}`}>{aluno.objetivo || '—'}</div>
            </div>
            <div className="cli-profile-item full">
              <div className="cli-profile-label">Lesões / Restrições</div>
              <div className={`cli-profile-value${aluno.restricoes ? '' : ' empty'}`}>{aluno.restricoes || '—'}</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={onEditPerfil}>
              ✏️ Editar dados cadastrais
            </button>
            <button className="btn btn-danger btn-sm" style={{ marginTop: 4 }} onClick={handleExcluir}>
              🗑️ Excluir aluno
            </button>
          </div>
        )}

        <RotinasDoAlunoSection email={aluno.email} onEditar={(r) => void handleEditarRotinaDaNuvem(r)} />

        {origemRascunho && (
          <div className="cli-last" style={{ marginBottom: 8 }}>
            Semana abaixo carregada da rotina "{origemRascunho}". Edite e use Salvar &amp; Publicar para criar uma nova rotina atual.
          </div>
        )}

        {treinos.length > 0 ? (
          <div className="mrs-tabs" role="tablist" aria-label="Treinos da rotina">
            {treinos.map((t) => (
              <button
                key={t.letra}
                role="tab"
                aria-selected={t === treinoAtual}
                className={`mrs-tab${t === treinoAtual ? ' active' : ''}`}
                onClick={() => setActiveDay(t.dias[0])}
              >
                <span className="mrs-tab-letra">Treino {t.letra}</span>
                <span className="mrs-tab-dias">{formatarDias(t.dias)}</span>
              </button>
            ))}
          </div>
        ) : null}

        {treinoAtual && (
          <div className="cli-day-type">
            {dia.tipo} · {dia.exercicios.length} ex.
          </div>
        )}

        <div className="cli-ex-list">
          {dia.exercicios.length === 0 ? (
            <div className="cli-rest-day">💤 Nenhum treino montado ainda. Use "Editar Rotina" para começar.</div>
          ) : (
            buildGroupedRows(dia.exercicios).map((row) =>
              row.kind === 'free' ? (
                renderExItem(row.entry, row.index)
              ) : (
                <div className="cj-group" key={row.groupId}>
                  <div className="cj-group-header">
                    <span className="cj-group-badge">{GROUP_LABELS[row.members[0].entry.groupType ?? 'biset']}</span>
                    <span className="cj-group-desc">{row.members.length} exercícios conjugados</span>
                  </div>
                  {row.members.map((m, k) => (
                    <div key={m.index}>
                      {k > 0 && <div className="cj-connector" />}
                      {renderExItem(m.entry, m.index)}
                    </div>
                  ))}
                </div>
              )
            )
          )}
        </div>

        {descanso.length > 0 && treinos.length > 0 && (
          <div className="mrs-descanso mrs-descanso-fim">💤 Descanso: {formatarDias(descanso)}</div>
        )}

        <div className="cli-detail-actions cli-sticky-actions">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => void handleIniciarRotina()}>
            ▶ Iniciar Rotina
          </button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => onEditarRotina(treinoAtual ? treinoAtual.dias[0] : activeDay)}>
            ✎ Editar{treinoAtual ? ` Treino ${treinoAtual.letra}` : ''}
          </button>
        </div>
      </div>

      {avaliacaoOpen && (
        <ErrorBoundary area="a Avaliação Física" onClose={() => setAvaliacaoOpen(false)}>
          <AvaliacaoFisicaModal alunoId={alunoId} onClose={() => setAvaliacaoOpen(false)} />
        </ErrorBoundary>
      )}
    </div>
  );
}
