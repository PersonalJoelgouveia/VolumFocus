import { useState } from 'react';
import { idFromEmbedUrl } from '../../utils/youtubeParser';
import type { Exercise } from '../../types/exercise';
import { PersonalVideoRecorder } from './PersonalVideoRecorder';
import './ExecutionMediaSection.css';

interface ExecutionMediaSectionProps {
  exercise: Exercise;
}

/**
 * Seção de mídia dentro do Modal de Execução — imagens de posição
 * inicial/final e vídeo do YouTube (geridos pelo Personal, mesmos dados
 * de types/exercise.ts) + o vídeo pessoal do aluno (PersonalVideoRecorder,
 * também usado no modal de mídia do Registro — mesma lógica, sem duplicar).
 *
 * Colapsada por padrão: fica isolada do resto do modal (timer de
 * descanso, séries, carga) tanto em estado quanto visualmente — abrir
 * ou gravar aqui nunca pausa nem reseta o cronômetro, que roda no seu
 * próprio efeito em ExecutionModal.tsx.
 */
export function ExecutionMediaSection({ exercise }: ExecutionMediaSectionProps) {
  const [open, setOpen] = useState(false);

  const ytId = idFromEmbedUrl(exercise.ytVideoUrl);
  const hasSharedMedia = !!(exercise.imgInicio || exercise.imgFim || ytId);

  return (
    <div>
      <button className={`exec-media-toggle${open ? ' is-open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span>🎬 Mídia do Exercício</span>
        <span className="exec-media-toggle-chevron">▼</span>
      </button>

      {open && (
        <div className="exec-media-body">
          {hasSharedMedia && (
            <>
              {(exercise.imgInicio || exercise.imgFim) && (
                <div className="exec-media-imgs">
                  {exercise.imgInicio && (
                    <div className="exec-media-img-slot">
                      <img src={exercise.imgInicio} alt="Posição inicial" />
                      <span className="exec-media-img-label">Início</span>
                    </div>
                  )}
                  {exercise.imgFim && (
                    <div className="exec-media-img-slot">
                      <img src={exercise.imgFim} alt="Posição final" />
                      <span className="exec-media-img-label">Final</span>
                    </div>
                  )}
                </div>
              )}
              {ytId && (
                <div className="exec-media-yt">
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title={`Vídeo demonstrativo — ${exercise.name}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </>
          )}

          <PersonalVideoRecorder exercise={exercise} />
        </div>
      )}
    </div>
  );
}
