import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../../lib/exerciseMediaRepository';
import {
  PHOTO_POSES,
  deletePhoto,
  getPhotoObjectUrl,
  getPhotosByAssessment,
  savePhoto,
  type PhotoPose,
} from '../../lib/assessmentPhotoStore';
import './FotosComparativas.css';

const POSE_LABELS: Record<PhotoPose, string> = {
  front: 'Frente',
  back: 'Costas',
  rightSide: 'Lado direito',
  leftSide: 'Lado esquerdo',
};

/** Lê as dimensões reais do blob comprimido — compressImage() não as expõe. */
function lerDimensoes(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem capturada'));
    };
    img.src = url;
  });
}

interface FotosComparativasProps {
  alunoId: string;
  assessmentId: string;
}

/**
 * Etapa 1 do módulo de Fotos Comparativas: captura por pose + persistência
 * local (IndexedDB — ver lib/assessmentPhotoStore.ts). Comparação lado a
 * lado entre avaliações é escopo de uma etapa futura; aqui só a
 * infraestrutura e a UI de captura/gestão das 4 poses de UMA avaliação.
 *
 * Captura via `<input type="file" accept="image/*" capture>` — abre a
 * câmera nativa do aparelho direto, sem precisar de getUserMedia/viewfinder
 * próprio (mais simples, mais compatível, e é o mesmo padrão que qualquer
 * app mobile-web usa pra "tirar uma foto rápida").
 */
export function FotosComparativas({ alunoId, assessmentId }: FotosComparativasProps) {
  const [urls, setUrls] = useState<Partial<Record<PhotoPose, string>>>({});
  const [carregando, setCarregando] = useState<PhotoPose | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRefs = useRef<Partial<Record<PhotoPose, HTMLInputElement | null>>>({});
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const referencias = await getPhotosByAssessment(assessmentId);
      const novasUrls: Partial<Record<PhotoPose, string>> = {};
      for (const pose of PHOTO_POSES) {
        if (referencias[pose]) {
          const url = await getPhotoObjectUrl(assessmentId, pose);
          if (url) novasUrls[pose] = url;
        }
      }
      if (!cancelado) setUrls(novasUrls);
    })();
    return () => {
      cancelado = true;
      Object.values(urlsRef.current).forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [assessmentId]);

  async function handleCapturar(pose: PhotoPose, file: File) {
    setErro(null);
    setCarregando(pose);
    try {
      const blob = await compressImage(file);
      const { width, height } = await lerDimensoes(blob);
      await savePhoto(alunoId, assessmentId, pose, blob, { width, height });
      const url = URL.createObjectURL(blob);
      setUrls((prev) => {
        if (prev[pose]) URL.revokeObjectURL(prev[pose] as string);
        return { ...prev, [pose]: url };
      });
    } catch (e) {
      console.error('FotosComparativas: falha ao capturar foto', e);
      setErro('Não foi possível salvar a foto. Tente novamente.');
    } finally {
      setCarregando(null);
    }
  }

  async function handleRemover(pose: PhotoPose) {
    await deletePhoto(assessmentId, pose);
    setUrls((prev) => {
      if (prev[pose]) URL.revokeObjectURL(prev[pose] as string);
      const resto = { ...prev };
      delete resto[pose];
      return resto;
    });
  }

  return (
    <div className="fc-wrapper">
      <div className="fc-grid">
        {PHOTO_POSES.map((pose) => (
          <div key={pose} className="fc-slot">
            <input
              ref={(el) => {
                inputRefs.current[pose] = el;
              }}
              type="file"
              accept="image/*"
              capture="environment"
              className="fc-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) handleCapturar(pose, file);
              }}
            />
            <button
              type="button"
              className="fc-slot-btn"
              onClick={() => inputRefs.current[pose]?.click()}
              disabled={carregando === pose}
              aria-label={urls[pose] ? `Retirar nova foto — ${POSE_LABELS[pose]}` : `Capturar foto — ${POSE_LABELS[pose]}`}
            >
              {urls[pose] ? (
                <img src={urls[pose]} alt={`Foto — ${POSE_LABELS[pose]}`} className="fc-thumb" />
              ) : (
                <span className="fc-placeholder">{carregando === pose ? 'Salvando…' : '📷'}</span>
              )}
            </button>
            <div className="fc-slot-label">{POSE_LABELS[pose]}</div>
            {urls[pose] && (
              <button type="button" className="fc-remove-btn" onClick={() => handleRemover(pose)}>
                Remover
              </button>
            )}
          </div>
        ))}
      </div>
      {erro && (
        <div className="fc-error" role="alert">
          {erro}
        </div>
      )}
    </div>
  );
}
