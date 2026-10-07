import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { DAYS_SHORT } from '../../types/workout';
import { calcularIdade, iniciais } from '../../types/aluno';
import { deletePhotosByAluno } from '../../lib/assessmentPhotoStore';
import { deletePersonalVideosByCliente } from '../../lib/localVideoStore';
import { limparRascunhoOnline } from '../../lib/onlineAssessmentDraftStore';
import { useSessionStore } from '../../store/useSessionStore';
import { exerciciosNoDiaDaSessao, iniciarSessaoComTreino } from '../../lib/aplicarTreinoNoDia';
import { getTodayDayIndex } from '../../utils/dayIndex';
import type { TreinoAgrupado } from '../../utils/agruparTreinos';
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
import type { AlunoRotinaSalva } from '../../types/aluno';
/**
 * Sucessor de #modal-cli-aluno (cli_openAluno/cli_renderMiniPerfil/
 * cli_renderDaysBar/cli_renderDayContent, index.html ~10603-10716):
 * mini-perfil colapsável + Rotinas do aluno (rotina → treino A/B/C → iniciar hoje na
 * sessão). "Editor de rotina" abre o RoutineEditorModal.
 */
export function AlunoDetailModal({ alunoId, onClose, onEditPerfil, onEditarRotina }: AlunoDetailModalProps) {
  const aluno = useAlunoStore((s) => s.getAluno(alunoId));
  const removeAluno = useAlunoStore((s) => s.removeAluno);
  const showToast = useUIStore((s) => s.showToast);

  const setRotinaDia = useAlunoStore((s) => s.setRotinaDia);
  const rotinasNuvem = useRotinasDoAlunoStore(selectRotinasDoAluno(aluno?.email ?? ''));

  /** Copia a rotina da nuvem para o rascunho local que o editor (Criar Treino) usa. A nuvem não muda. */
  function carregarNoRascunho(r: AlunoRotinaSalva) {
    const copia = JSON.parse(JSON.stringify(r.rotina)) as AlunoRotinaSalva['rotina'];
    copia.forEach((dia, d) => setRotinaDia(alunoId, d, dia));
  }

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

  /** Treino escolhido (A/B/C…) → sessão do aluno aberta no dia de HOJE, avisando se há sobreposição. */
  async function handleIniciarTreino(treino: TreinoAgrupado) {
    const hoje = getTodayDayIndex();
    const n = exerciciosNoDiaDaSessao(aluno!.id, hoje);
    if (n > 0) {
      const ok = await useConfirmStore.getState().ask(
        `${aluno!.nome.split(' ')[0]} já tem ${n} exercício${n === 1 ? '' : 's'} em ${DAYS_SHORT[hoje]} na sessão aberta. Substituir pelo Treino ${treino.letra}? O progresso desse dia será perdido.`,
        { confirmLabel: `Substituir por Treino ${treino.letra}`, danger: true }
      );
      if (!ok) return;
    }
    const r = iniciarSessaoComTreino(aluno!.id, aluno!.nome, treino.dia);
    if (!r.ok) {
      showToast('⚠️ Limite de sessões simultâneas atingido. Encerre uma sessão para iniciar outra.', 'warning');
      return;
    }
    showToast(`✅ Treino ${treino.letra} aberto em ${DAYS_SHORT[hoje]} na sessão de ${aluno!.nome.split(' ')[0]}`, 'success');
    onClose();
  }

  /** Abre o editor no rascunho; se o rascunho está em branco, parte da rotina atual da nuvem. */
  function handleAbrirEditor() {
    if (rotinaSemExercicios(aluno!.rotina) && rotinasNuvem.ativa) carregarNoRascunho(rotinasNuvem.ativa);
    const fonte = rotinaSemExercicios(aluno!.rotina) && rotinasNuvem.ativa ? rotinasNuvem.ativa.rotina : aluno!.rotina;
    const primeiro = fonte.findIndex((d) => d.exercicios.length > 0);
    onEditarRotina(primeiro >= 0 ? primeiro : 0);
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

        <RotinasDoAlunoSection email={aluno.email} onEditar={(r) => void handleEditarRotinaDaNuvem(r)}
          onUsarTreino={(_, t) => void handleIniciarTreino(t)}
        />

        <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 12 }} onClick={handleAbrirEditor}>
          ✎ Editor de rotina (criar / editar)
        </button>
      </div>

      {avaliacaoOpen && (
        <ErrorBoundary area="a Avaliação Física" onClose={() => setAvaliacaoOpen(false)}>
          <AvaliacaoFisicaModal alunoId={alunoId} onClose={() => setAvaliacaoOpen(false)} />
        </ErrorBoundary>
      )}
    </div>
  );
}
