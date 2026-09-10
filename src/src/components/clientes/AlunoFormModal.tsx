import { useState } from 'react';
import { useAlunoStore } from '../../store/useAlunoStore';
import { useUIStore } from '../../store/useUIStore';
import { syncAlunoPerfilToCloud } from '../../lib/alunoRepository';
import type { Aluno } from '../../types/aluno';
import './ClientesView.css';

interface AlunoFormModalProps {
  /** undefined = criando um aluno novo; Aluno = editando um existente. */
  aluno: Aluno | undefined;
  onClose: () => void;
}

/**
 * Cadastro/edição de aluno — sucessor de cli_openNovoAluno()/cli_salvarNovoAluno()
 * (index.html ~10505-10542) e da edição de campos do mini-perfil. Ao salvar,
 * também sincroniza o perfil com o Firestore (syncAlunoPerfilToCloud),
 * mesma trilha de syncClientToCloud().
 */
export function AlunoFormModal({ aluno, onClose }: AlunoFormModalProps) {
  const addAluno = useAlunoStore((s) => s.addAluno);
  const updateAluno = useAlunoStore((s) => s.updateAluno);
  const showToast = useUIStore((s) => s.showToast);

  const [nome, setNome] = useState(aluno?.nome ?? '');
  const [email, setEmail] = useState(aluno?.email ?? '');
  const [foco, setFoco] = useState(aluno?.foco ?? '');
  const [dataNascimento, setDataNascimento] = useState(aluno?.dataNascimento ?? '');
  const [telefone, setTelefone] = useState(aluno?.telefone ?? '');
  const [genero, setGenero] = useState(aluno?.genero ?? '');
  const [objetivo, setObjetivo] = useState(aluno?.objetivo ?? '');
  const [restricoes, setRestricoes] = useState(aluno?.restricoes ?? '');
  const [saving, setSaving] = useState(false);

  const isEdit = !!aluno;
  const valid = nome.trim().length > 0 && email.trim().includes('@');

  async function handleSave() {
    if (!valid || saving) return;
    setSaving(true);
    const patch = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      foco: foco.trim() || 'Geral',
      dataNascimento: dataNascimento || undefined,
      telefone: telefone.trim() || undefined,
      genero: genero.trim() || undefined,
      objetivo: objetivo.trim() || undefined,
      restricoes: restricoes.trim() || undefined,
    };

    const saved = isEdit ? { ...aluno, ...patch } : addAluno(patch);
    if (isEdit) updateAluno(aluno.id, patch);

    await syncAlunoPerfilToCloud(saved);
    setSaving(false);
    showToast(isEdit ? '✅ Aluno atualizado' : '✅ Aluno cadastrado', 'success');
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-form-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Editar Aluno' : 'Novo Aluno'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="cli-form-grid">
          <label className="cli-form-field full">
            <span>Nome completo</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do aluno" />
          </label>
          <label className="cli-form-field full">
            <span>E-mail (login do aluno)</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aluno@gmail.com" />
          </label>
          <label className="cli-form-field">
            <span>Foco</span>
            <input value={foco} onChange={(e) => setFoco(e.target.value)} placeholder="Ex: Hipertrofia" />
          </label>
          <label className="cli-form-field">
            <span>Data de nascimento</span>
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
          </label>
          <label className="cli-form-field">
            <span>WhatsApp</span>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </label>
          <label className="cli-form-field">
            <span>Gênero</span>
            <input value={genero} onChange={(e) => setGenero(e.target.value)} />
          </label>
          <label className="cli-form-field full">
            <span>Objetivo</span>
            <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          </label>
          <label className="cli-form-field full">
            <span>Lesões / Restrições</span>
            <textarea rows={2} value={restricoes} onChange={(e) => setRestricoes(e.target.value)} />
          </label>
        </div>

        <button className="btn-block-primary" disabled={!valid || saving} onClick={handleSave}>
          {saving ? 'Salvando…' : isEdit ? 'Salvar Alterações' : 'Cadastrar Aluno'}
        </button>
      </div>
    </div>
  );
}
