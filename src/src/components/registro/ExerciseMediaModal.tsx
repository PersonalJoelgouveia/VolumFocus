import { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import type { Exercise } from '../../types/exercise';
import { ExerciseMediaPicker } from '../banco/ExerciseMediaPicker';
import type { ExerciseMediaValue } from '../banco/ExerciseMediaPicker';
import { idFromEmbedUrl } from '../../utils/youtubeParser';
import { PersonalVideoRecorder } from './PersonalVideoRecorder';
import './ExerciseMediaModal.css';

interface ExerciseMediaModalProps {
  exercise: Exercise;
  onClose: () => void;
}

/**
 * Mídia de um exercício, acessível direto de Treinos → Semana Atual
 * (ícone 🎬/📷 em cada exercício do dia). Dois blocos independentes:
 *
 * 1. Vídeo pessoal (PersonalVideoRecorder) — SEMPRE visível, pra
 *    QUALQUER pessoa logada (aluno ou Personal). Não é uma ferramenta
 *    do Personal: é o aluno gravando/anexando o próprio vídeo fazendo o
 *    exercício, guardado só neste aparelho.
 * 2. Imagens de posição inicial/final + YouTube — geridas pelo Personal
 *    (ExerciseMediaPicker do Banco, reaproveitado aqui sem duplicar
 *    lógica de upload/compressão), visualização liberada pra todos.
 */
export function ExerciseMediaModal({ exercise, onClose }: ExerciseMediaModalProps) {
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const showToast = useUIStore((s) => s.showToast);
  const updateExercise = useExerciseStore((s) => s.updateExercise);

  const hasSharedMedia = !!(exercise.imgInicio || exercise.imgFim || exercise.ytVideoUrl);
  const [editing, setEditing] = useState(false);
  const [media, setMedia] = useState<ExerciseMediaValue>({
    imgInicio: exercise.imgInicio ?? null,
    imgFim: exercise.imgFim ?? null,
    ytVideoUrl: exercise.ytVideoUrl ?? null,
  });

  const ytId = idFromEmbedUrl(exercise.ytVideoUrl);

  function handleSalvar() {
    updateExercise(exercise.id, {
      imgInicio: media.imgInicio,
      imgFim: media.imgFim,
      ytVideoUrl: media.ytVideoUrl,
    });
    showToast('✅ Mídia atualizada', 'success');
    setEditing(false);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cli-detail-panel exmedia-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎬 {exercise.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <PersonalVideoRecorder exercise={exercise} />

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '18px 0 14px' }} />

        {editing ? (
          <>
            <ExerciseMediaPicker exerciseId={exercise.id} value={media} onChange={setMedia} />
            <div className="exmedia-edit-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSalvar}>
                💾 Salvar Mídia
              </button>
            </div>
          </>
        ) : hasSharedMedia ? (
          <>
            {(exercise.imgInicio || exercise.imgFim) && (
              <div className="exmedia-view-row">
                {exercise.imgInicio && (
                  <div className="exmedia-view-slot">
                    <img src={exercise.imgInicio} alt="Posição inicial" />
                    <span className="exmedia-view-label">Posição Inicial</span>
                  </div>
                )}
                {exercise.imgFim && (
                  <div className="exmedia-view-slot">
                    <img src={exercise.imgFim} alt="Posição final" />
                    <span className="exmedia-view-label">Posição Final</span>
                  </div>
                )}
              </div>
            )}
            {ytId && (
              <div className="exmedia-yt-frame" style={{ marginTop: (exercise.imgInicio || exercise.imgFim) ? 10 : 0 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title={`Vídeo demonstrativo — ${exercise.name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
            {isPersonalMode && (
              <button className="btn btn-ghost btn-sm btn-full" style={{ marginTop: 14 }} onClick={() => setEditing(true)}>
                ✏️ Editar Mídia do Personal
              </button>
            )}
          </>
        ) : (
          <div className="exmedia-empty">
            📷 O Personal ainda não cadastrou imagens nem vídeo pra este exercício.
            {isPersonalMode && (
              <>
                <br />
                <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={() => setEditing(true)}>
                  + Adicionar Mídia do Personal
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
