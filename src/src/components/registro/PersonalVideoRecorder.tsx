import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { deletePersonalVideo, getPersonalVideo, isIndexedDbAvailable, savePersonalVideo } from '../../lib/localVideoStore';
import type { Exercise } from '../../types/exercise';
import './PersonalVideoRecorder.css';

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

interface PersonalVideoRecorderProps {
  exercise: Exercise;
}

/**
 * Vídeo pessoal do exercício — gravado ao vivo (câmera) ou escolhido da
 * galeria, armazenado EXCLUSIVAMENTE neste dispositivo via IndexedDB
 * (lib/localVideoStore.ts), nunca sobe pro Firebase. Ferramenta do
 * ALUNO (qualquer pessoa logada, não só o Personal) — pra ele mesmo
 * registrar como está executando o exercício e comparar depois.
 *
 * Componente único, sem estado externo além de `exercise` — reaproveitado
 * tanto no Modal de Execução (ExecutionMediaSection) quanto no modal de
 * mídia aberto direto da lista de exercícios do Registro
 * (ExerciseMediaModal, alcançável em Treinos → Semana Atual), pra não
 * duplicar a lógica de câmera/IndexedDB em dois lugares.
 */
export function PersonalVideoRecorder({ exercise }: PersonalVideoRecorderProps) {
  const userEmail = useAuthStore((s) => s.user?.email);
  const showToast = useUIStore((s) => s.showToast);

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

  // Carrega o vídeo pessoal salvo neste dispositivo (se existir) ao montar.
  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    setSavedBlob('loading');
    (async () => {
      try {
        if (!isIndexedDbAvailable()) throw new Error('IndexedDB indisponível');
        const rec = await getPersonalVideo(userEmail, exercise.id);
        if (cancelled) return;
        setSavedBlob(rec ? rec.blob : null);
      } catch (e) {
        console.warn('PersonalVideoRecorder: falha ao ler vídeo local', e);
        if (!cancelled) setSavedBlob('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmail, exercise.id]);

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

  // Libera a câmera ao desmontar — nunca deixa a luz da câmera acesa em segundo plano.
  useEffect(() => stopStream, []);

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
      console.error('PersonalVideoRecorder: falha ao acessar câmera', e);
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
      console.error('PersonalVideoRecorder: falha ao iniciar gravação', e);
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
      console.error('PersonalVideoRecorder: falha ao salvar vídeo local', e);
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
      console.error('PersonalVideoRecorder: falha ao salvar vídeo da galeria', e);
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
      console.error('PersonalVideoRecorder: falha ao remover vídeo local', e);
      showToast('⚠️ Não foi possível remover o vídeo.', 'error');
    }
  }

  return (
    <div className="pv-wrap">
      <div className="pv-section-label">📱 Meu vídeo (gravado por você, só neste aparelho)</div>

      {phase === 'live' && (
        <div className="pv-record-wrap">
          <div className="pv-record-preview">
            <video ref={liveVideoRef} autoPlay muted playsInline />
          </div>
          <div className="pv-record-controls">
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
        <div className="pv-record-wrap">
          <div className="pv-record-preview">
            <video ref={liveVideoRef} autoPlay muted playsInline />
          </div>
          <div className="pv-rec-dot">GRAVANDO · {fmtRecTime(recSeconds)}</div>
          <div className="pv-record-controls">
            <button className="btn btn-danger" onClick={handleStopRecording}>
              ⏹ Parar Gravação
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && reviewUrl && (
        <div className="pv-record-wrap">
          <div className="pv-record-preview">
            <video src={reviewUrl} controls playsInline />
          </div>
          <div className="pv-record-controls">
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
          {savedBlob === 'loading' && <div className="pv-empty">Carregando…</div>}

          {(savedBlob === null || savedBlob === 'error') && <div className="pv-empty">{UNAVAILABLE_MSG}</div>}

          {savedBlob instanceof Blob && savedUrl && (
            <div className="pv-video-player">
              <video src={savedUrl} controls playsInline />
            </div>
          )}

          <div className="pv-video-actions">
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
  );
}
