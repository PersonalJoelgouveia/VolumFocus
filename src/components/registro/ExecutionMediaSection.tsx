import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { deletePersonalVideo, getPersonalVideo, isIndexedDbAvailable, savePersonalVideo } from '../../lib/localVideoStore';
import { idFromEmbedUrl } from '../../utils/youtubeParser';
import type { Exercise } from '../../types/exercise';
import { useConfirmStore } from '../../store/useConfirmStore';
import './ExecutionMediaSection.css';

const UNAVAILABLE_MSG = 'Vídeo não disponível neste dispositivo.';

type RecorderPhase = 'idle' | 'live' | 'recording' | 'review';

function fmtRecTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function pickMimeType(): string | undefined {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
  }
  return undefined;
}

interface ExecutionMediaSectionProps {
  exercise: Exercise;
}

/**
 * Seção de mídia dentro do Modal de Execução — imagens de posição
 * inicial/final e vídeo do YouTube (geridos pelo Personal, mesmos dados
 * de types/exercise.ts) + vídeo PESSOAL gravado ou escolhido da galeria,
 * armazenado só neste dispositivo via IndexedDB (lib/localVideoStore.ts)
 * — nunca sobe pro Firebase.
 *
 * Colapsada por padrão: fica isolada do resto do modal (timer de
 * descanso, séries, carga) tanto em estado quanto visualmente — abrir
 * ou gravar aqui nunca pausa nem reseta o cronômetro, que roda no seu
 * próprio efeito em ExecutionModal.tsx.
 */
export function ExecutionMediaSection({ exercise }: ExecutionMediaSectionProps) {
  const userEmail = useAuthStore((s) => s.user?.email);
  const showToast = useUIStore((s) => s.showToast);

  const [open, setOpen] = useState(false);

  const [savedBlob, setSavedBlob] = useState<Blob | null | 'loading' | 'error'>('loading');
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [reviewBlob, setReviewBlob] = useState<Blob | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const ytId = idFromEmbedUrl(exercise.ytVideoUrl);
  const hasSharedMedia = !!(exercise.imgInicio || exercise.imgFim || ytId);

  // Carrega o vídeo pessoal salvo neste dispositivo (se existir) ao abrir a seção.
  useEffect(() => {
    if (!open || !userEmail) return;
    let cancelled = false;
    setSavedBlob('loading');
    (async () => {
      try {
        if (!isIndexedDbAvailable()) throw new Error('IndexedDB indisponível');
        const rec = await getPersonalVideo(userEmail, exercise.id);
        if (cancelled) return;
        setSavedBlob(rec ? rec.blob : null);
      } catch (e) {
        console.warn('ExecutionMediaSection: falha ao ler vídeo local', e);
        if (!cancelled) setSavedBlob('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userEmail, exercise.id]);

  // Mantém a Object URL do vídeo salvo sincronizada, revogando a anterior.
  useEffect(() => {
    if (savedBlob instanceof Blob) {
      const url = URL.createObjectURL(savedBlob);
      setSavedUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setSavedUrl(null);
  }, [savedBlob]);

  // Object URL do preview de revisão (gravação recém-feita, antes de salvar).
  useEffect(() => {
    if (reviewBlob) {
      const url = URL.createObjectURL(reviewBlob);
      setReviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setReviewUrl(null);
  }, [reviewBlob]);

  // Libera a câmera sempre que a seção fecha ou o componente desmonta —
  // nunca deixa a luz da câmera acesa em segundo plano.
  useEffect(() => {
    if (!open) stopStream();
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== 'recording') return;
    setRecSeconds(0);
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (liveVideoRef.current && streamRef.current && (phase === 'live' || phase === 'recording')) {
      liveVideoRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        /* já parado */
      }
    }
    recorderRef.current = null;
  }

  async function handleStartCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      setPhase('live');
    } catch (e) {
      console.error('ExecutionMediaSection: falha ao acessar câmera', e);
      showToast('⚠️ Não foi possível acessar a câmera. Verifique as permissões.', 'error');
    }
  }

  function handleStartRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    try {
      const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType ?? 'video/webm' });
        setReviewBlob(blob);
        setPhase('review');
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setPhase('recording');
    } catch (e) {
      console.error('ExecutionMediaSection: falha ao iniciar gravação', e);
      showToast('⚠️ Não foi possível iniciar a gravação neste dispositivo.', 'error');
    }
  }

  function handleStopRecording() {
    recorderRef.current?.stop();
  }

  function handleCancelLive() {
    stopStream();
    setPhase('idle');
  }

  function handleDiscardReview() {
    setReviewBlob(null);
    setPhase('idle');
  }

  function handleRecordAgain() {
    setReviewBlob(null);
    handleStartCamera();
  }

  async function handleSaveReview() {
    if (!reviewBlob || !userEmail) return;
    try {
      await savePersonalVideo(userEmail, exercise.id, reviewBlob);
      setSavedBlob(reviewBlob);
      setReviewBlob(null);
      setPhase('idle');
      showToast('✅ Vídeo salvo neste dispositivo!', 'success');
    } catch (e) {
      console.error('ExecutionMediaSection: falha ao salvar vídeo local', e);
      showToast('⚠️ Não foi possível salvar o vídeo neste dispositivo.', 'error');
    }
  }

  async function handleGallerySelect(file: File | undefined) {
    if (!file || !userEmail) return;
    if (!file.type.startsWith('video/')) return showToast('⚠️ Selecione um arquivo de vídeo.', 'warning');
    if (file.size > 300 * 1024 * 1024) {
      showToast('⚠️ Vídeo grande — pode demorar ou não caber no armazenamento do dispositivo.', 'warning');
    }
    try {
      await savePersonalVideo(userEmail, exercise.id, file);
      setSavedBlob(file);
      showToast('✅ Vídeo salvo neste dispositivo!', 'success');
    } catch (e) {
      console.error('ExecutionMediaSection: falha ao salvar vídeo da galeria', e);
      showToast('⚠️ Não foi possível salvar o vídeo neste dispositivo.', 'error');
    } finally {
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  }

  async function handleRemoveSaved() {
    if (!userEmail) return;
    const ok = await useConfirmStore.getState().ask('Remover o vídeo pessoal deste dispositivo?', {
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePersonalVideo(userEmail, exercise.id);
      setSavedBlob(null);
      showToast('🗑️ Vídeo removido deste dispositivo', 'success');
    } catch (e) {
      console.error('ExecutionMediaSection: falha ao remover vídeo local', e);
      showToast('⚠️ Não foi possível remover o vídeo.', 'error');
    }
  }

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

          <div className="exec-media-section-label">📱 Meu vídeo (só neste aparelho)</div>

          {phase === 'live' && (
            <div className="exec-media-record-wrap">
              <div className="exec-media-record-preview">
                <video ref={liveVideoRef} autoPlay muted playsInline />
              </div>
              <div className="exec-media-record-controls">
                <button className="btn btn-primary" onClick={handleStartRecording}>
                  ⏺ Iniciar Gravação
                </button>
                <button className="btn btn-ghost" onClick={handleCancelLive}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {phase === 'recording' && (
            <div className="exec-media-record-wrap">
              <div className="exec-media-record-preview">
                <video ref={liveVideoRef} autoPlay muted playsInline />
              </div>
              <div className="exec-media-rec-dot">GRAVANDO · {fmtRecTime(recSeconds)}</div>
              <div className="exec-media-record-controls">
                <button className="btn btn-danger" onClick={handleStopRecording}>
                  ⏹ Parar Gravação
                </button>
              </div>
            </div>
          )}

          {phase === 'review' && reviewUrl && (
            <div className="exec-media-record-wrap">
              <div className="exec-media-record-preview">
                <video src={reviewUrl} controls playsInline />
              </div>
              <div className="exec-media-record-controls">
                <button className="btn btn-primary" onClick={handleSaveReview}>
                  💾 Salvar
                </button>
                <button className="btn btn-ghost" onClick={handleRecordAgain}>
                  🔄 Gravar de Novo
                </button>
                <button className="btn btn-ghost" onClick={handleDiscardReview}>
                  ✕ Descartar
                </button>
              </div>
            </div>
          )}

          {phase === 'idle' && (
            <>
              {savedBlob === 'loading' && <div className="exec-media-empty">Carregando…</div>}

              {(savedBlob === null || savedBlob === 'error') && (
                <div className="exec-media-empty">{UNAVAILABLE_MSG}</div>
              )}

              {savedBlob instanceof Blob && savedUrl && (
                <div className="exec-media-video-player">
                  <video src={savedUrl} controls playsInline />
                </div>
              )}

              <div className="exec-media-video-actions">
                <button className="btn btn-primary" onClick={handleStartCamera}>
                  🎥 Gravar Vídeo
                </button>
                <button className="btn btn-ghost" onClick={() => galleryInputRef.current?.click()}>
                  🖼️ Selecionar da Galeria
                </button>
                {savedBlob instanceof Blob && (
                  <button className="btn btn-danger" onClick={handleRemoveSaved}>
                    🗑️ Remover
                  </button>
                )}
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={(e) => handleGallerySelect(e.target.files?.[0])}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
