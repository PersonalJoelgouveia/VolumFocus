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
  rightSide: 'Perfil D',
  leftSide: 'Perfil E',
};

/** Orientação de postura por pose — texto curto, sem análise corporal. */
const POSE_INSTRUCOES: Record<PhotoPose, string> = {
  front: 'De frente, em pé, braços relaxados ao lado do corpo e pés na largura dos ombros.',
  back: 'De costas, mesma postura, calcanhares alinhados e ombros relaxados.',
  rightSide: 'Perfil direito, braços soltos ao lado do corpo e olhar à frente.',
  leftSide: 'Perfil esquerdo, braços soltos ao lado do corpo e olhar à frente.',
};

/** Lê as dimensões reais do blob final — compressImage() não as expõe. */
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
  /** false = só visualização (Aluno fora do fluxo Online). Default true —
   *  mantém o comportamento dos formulários atuais, que só o Personal alcança. */
  podeEditar?: boolean;
}

/**
 * Coleta das 4 poses de UMA avaliação: capturar → revisar → refazer →
 * salvar. Comparação entre avaliações NÃO acontece aqui — só na
 * visualização de uma avaliação já salva (ver PhotoComparisonView).
 *
 * Câmera via `navigator.mediaDevices.getUserMedia()`, aberta apenas quando
 * o usuário toca em "Capturar" (a permissão nunca é pedida ao montar). Se
 * a API não existir ou a permissão for negada, cai num `<input type="file"
 * capture>` — a câmera nativa do aparelho.
 *
 * Sem reconhecimento facial, análise corporal ou filtro: o guia do visor é
 * uma moldura estática de enquadramento, e a imagem salva é exatamente o
 * frame capturado (apenas redimensionado/recomprimido).
 */
export function FotosComparativas({ alunoId, assessmentId, podeEditar = true }: FotosComparativasProps) {
  const [urls, setUrls] = useState<Partial<Record<PhotoPose, string>>>({});
  const [salvandoPose, setSalvandoPose] = useState<PhotoPose | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /** Pose em captura (null = nenhuma). `revisao` guarda o frame ainda não salvo. */
  const [poseEmCaptura, setPoseEmCaptura] = useState<PhotoPose | null>(null);
  const [revisao, setRevisao] = useState<{ blob: Blob; url: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  // Carrega as fotos já capturadas desta avaliação.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const referencias = await getPhotosByAssessment(assessmentId);
        const novasUrls: Partial<Record<PhotoPose, string>> = {};
        for (const pose of PHOTO_POSES) {
          if (referencias[pose]) {
            const url = await getPhotoObjectUrl(assessmentId, pose);
            if (url) novasUrls[pose] = url;
          }
        }
        if (!cancelado) setUrls(novasUrls);
      } catch (e) {
        console.error('FotosComparativas: falha ao carregar fotos salvas', e);
        if (!cancelado) {
          setErro('Não foi possível acessar o armazenamento local de fotos neste navegador.');
        }
      }
    })();
    return () => {
      cancelado = true;
      Object.values(urlsRef.current).forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [assessmentId]);

  function pararCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Encerra a câmera ao desmontar — nunca deixa a câmera do aparelho ligada.
  useEffect(() => pararCamera, []);

  function fecharCaptura() {
    pararCamera();
    if (revisao) URL.revokeObjectURL(revisao.url);
    setRevisao(null);
    setPoseEmCaptura(null);
  }

  /** Permissão só é pedida aqui — nunca na montagem do componente. */
  async function handleAbrirCamera(pose: PhotoPose) {
    setErro(null);
    setPoseEmCaptura(pose);

    if (!navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click(); // fallback: câmera nativa
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1707 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      console.error('FotosComparativas: getUserMedia indisponível/negado', e);
      pararCamera();
      fileInputRef.current?.click(); // fallback: câmera nativa
    }
  }

  /** Congela o frame atual do visor pra revisão (ainda não grava). */
  function handleDisparar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setErro('A câmera ainda não está pronta. Aguarde um instante e tente novamente.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErro('Não foi possível capturar a imagem.');
          return;
        }
        pararCamera();
        setRevisao({ blob, url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.92
    );
  }

  /** Volta do passo de revisão pro visor, descartando o frame. */
  function handleRefazerCaptura() {
    if (!poseEmCaptura) return;
    if (revisao) URL.revokeObjectURL(revisao.url);
    setRevisao(null);
    handleAbrirCamera(poseEmCaptura);
  }

  /** Confirma o frame revisado (ou um arquivo do fallback) e grava local. */
  async function persistir(pose: PhotoPose, origem: Blob) {
    setSalvandoPose(pose);
    setErro(null);
    try {
      const arquivo = new File([origem], `${pose}.jpg`, { type: origem.type || 'image/jpeg' });
      const blob = await compressImage(arquivo);
      const { width, height } = await lerDimensoes(blob);
      await savePhoto(alunoId, assessmentId, pose, blob, { width, height });

      const url = URL.createObjectURL(blob);
      setUrls((prev) => {
        if (prev[pose]) URL.revokeObjectURL(prev[pose] as string);
        return { ...prev, [pose]: url };
      });
      fecharCaptura();
    } catch (e) {
      console.error('FotosComparativas: falha ao salvar foto', e);
      setErro('Não foi possível salvar a foto. Tente novamente.');
    } finally {
      setSalvandoPose(null);
    }
  }

  async function handleExcluir(pose: PhotoPose) {
    try {
      await deletePhoto(assessmentId, pose);
      setUrls((prev) => {
        if (prev[pose]) URL.revokeObjectURL(prev[pose] as string);
        const resto = { ...prev };
        delete resto[pose];
        return resto;
      });
    } catch (e) {
      console.error('FotosComparativas: falha ao excluir foto', e);
      setErro('Não foi possível excluir a foto. Tente novamente.');
    }
  }

  const concluidas = PHOTO_POSES.filter((p) => urls[p]).length;

  return (
    <div className="fc-wrapper">
      {podeEditar && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="fc-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file && poseEmCaptura) persistir(poseEmCaptura, file);
            else setPoseEmCaptura(null);
          }}
        />
      )}

      <div className="fc-progresso">
        {concluidas} de {PHOTO_POSES.length} poses capturadas
      </div>

      <div className="fc-grid">
        {PHOTO_POSES.map((pose) => {
          const capturada = !!urls[pose];
          return (
            <div key={pose} className="fc-slot">
              <div className="fc-slot-preview">
                {capturada ? (
                  <img src={urls[pose]} alt={`Foto — ${POSE_LABELS[pose]}`} className="fc-thumb" />
                ) : (
                  <div className="fc-placeholder">
                    {/* Guia de enquadramento: moldura estática, sem detecção. */}
                    <svg viewBox="0 0 60 80" className="fc-guia" aria-hidden="true">
                      <rect x="14" y="6" width="32" height="68" rx="16" />
                      <line x1="30" y1="6" x2="30" y2="74" strokeDasharray="3 4" />
                    </svg>
                  </div>
                )}
                <span className={`fc-status${capturada ? ' fc-status--ok' : ''}`}>
                  {salvandoPose === pose ? 'Salvando…' : capturada ? 'Concluído' : 'Pendente'}
                </span>
              </div>

              <div className="fc-slot-label">{POSE_LABELS[pose]}</div>
              <p className="fc-slot-instrucao">{POSE_INSTRUCOES[pose]}</p>

              {podeEditar && (
                <div className="fc-slot-acoes">
                  <button
                    type="button"
                    className="fc-acao-btn"
                    onClick={() => handleAbrirCamera(pose)}
                    disabled={salvandoPose === pose}
                  >
                    {capturada ? 'Refazer' : 'Capturar'}
                  </button>
                  {capturada && (
                    <button
                      type="button"
                      className="fc-acao-btn fc-acao-btn--danger"
                      onClick={() => handleExcluir(pose)}
                    >
                      Excluir
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {erro && (
        <div className="fc-error" role="alert">
          {erro}
        </div>
      )}

      {poseEmCaptura && (
        <div className="fc-camera" role="dialog" aria-label={`Capturar ${POSE_LABELS[poseEmCaptura]}`}>
          <div className="fc-camera-topo">
            <span>{POSE_LABELS[poseEmCaptura]}</span>
            <button type="button" className="fc-camera-fechar" onClick={fecharCaptura} aria-label="Fechar câmera">
              ×
            </button>
          </div>

          <p className="fc-camera-instrucao">{POSE_INSTRUCOES[poseEmCaptura]}</p>

          {erro && (
            <div className="fc-error fc-error--camera" role="alert">
              {erro}
            </div>
          )}

          <div className="fc-camera-palco">
            {revisao ? (
              <img src={revisao.url} alt="Foto capturada para revisão" className="fc-camera-midia" />
            ) : (
              <>
                <video ref={videoRef} className="fc-camera-midia" playsInline muted />
                <svg viewBox="0 0 60 80" className="fc-camera-guia" aria-hidden="true">
                  <rect x="14" y="6" width="32" height="68" rx="16" />
                  <line x1="30" y1="6" x2="30" y2="74" strokeDasharray="3 4" />
                </svg>
              </>
            )}
          </div>

          <div className="fc-camera-acoes">
            {revisao ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={handleRefazerCaptura}>
                  Refazer
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => persistir(poseEmCaptura, revisao.blob)}
                  disabled={salvandoPose === poseEmCaptura}
                >
                  {salvandoPose === poseEmCaptura ? 'Salvando…' : 'Usar foto'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={fecharCaptura}>
                  Cancelar
                </button>
                <button type="button" className="btn btn-primary" onClick={handleDisparar}>
                  Capturar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
