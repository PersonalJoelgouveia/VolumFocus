import { useState } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useExerciseStore } from '../../store/useExerciseStore';
import type { Exercise } from '../../types/exercise';
import { ExerciseMediaPicker } from '../banco/ExerciseMediaPicker';
import type { ExerciseMediaValue } from '../banco/ExerciseMediaPicker';
import { idFromEmbedUrl } from '../../utils/youtubeParser';
import './ExerciseMediaModal.css';

interface ExerciseMediaModalProps {
  exercise: Exercise;
  onClose: () => void;
}

/**
 * Visualização (e, pro Personal, edição) da mídia de um exercício —
 * acessível direto do Registro (Treino → Semana Atual), sem precisar
 * navegar até o Banco de Exercícios. Reaproveita o mesmo
 * ExerciseMediaPicker do Banco pro modo de edição — mesmo componente,
 * mesmo upload/compressão, sem duplicar lógica.
 */
export function ExerciseMediaModal({ exercise, onClose }: ExerciseMediaModalProps) {
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const showToast = useUIStore((s) => s.showToast);
  const updateExercise = useExerciseStore((s) => s.updateExercise);

  const hasMedia = !!(exercise.imgInicio || exercise.imgFim || exercise.ytVideoUrl);
  const [editing, setEditing] = useState(isPersonalMode && !hasMedia);
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
    onClose();
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

        {editing ? (
          <>
            <ExerciseMediaPicker exerciseId={exercise.id} value={media} onChange={setMedia} />
            <div className="exmedia-edit-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => (hasMedia ? setEditing(false) : onClose())}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSalvar}>
                💾 Salvar Mídia
              </button>
            </div>
          </>
        ) : hasMedia ? (
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
                ✏️ Editar Mídia
              </button>
            )}
          </>
        ) : (
          <div className="exmedia-empty">
            📷 Este exercício ainda não tem imagens nem vídeo cadastrados.
            {isPersonalMode && (
              <>
                <br />
                <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={() => setEditing(true)}>
                  + Adicionar Mídia
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
