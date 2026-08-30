import { useState } from 'react';
import type { MouseEvent } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { deleteExerciseImage, uploadExerciseImage } from '../../lib/exerciseMediaRepository';
import type { ImageSlotKey } from '../../lib/exerciseMediaRepository';
import { embedUrlFromId, extractYoutubeId, idFromEmbedUrl, thumbnailUrlFromId } from '../../utils/youtubeParser';
import './ExerciseMediaPicker.css';

export interface ExerciseMediaValue {
  imgInicio: string | null;
  imgFim: string | null;
  ytVideoUrl: string | null;
}

interface ExerciseMediaPickerProps {
  /** Id do exercício — usado como caminho no Storage. Para um exercício
   *  novo ainda não salvo, o chamador deve gerar um id estável (ver
   *  ExerciseCreatorPanel) e reutilizá-lo no addExercise() final, pra
   *  bater com o caminho onde a imagem já foi enviada. */
  exerciseId: string;
  value: ExerciseMediaValue;
  onChange: (value: ExerciseMediaValue) => void;
}

type MxMode = 'none' | 'img' | 'yt';

function initialMode(value: ExerciseMediaValue): MxMode {
  if (value.imgInicio || value.imgFim) return 'img';
  if (value.ytVideoUrl) return 'yt';
  return 'none';
}

/**
 * Sucessor do bloco "🎬 Mídia do Exercício" + módulo MX (index.html
 * ~3436-3467, ~5139-5347): abas Nenhuma/Imagens/YouTube, upload com
 * compressão (lib/exerciseMediaRepository) e parsing de link do YouTube
 * (utils/youtubeParser). Trocar de aba não apaga o que já foi
 * carregado na outra — só decide o que é persistido ao salvar, igual ao
 * `obterPayloadDeMidia()` original.
 */
export function ExerciseMediaPicker({ exerciseId, value, onChange }: ExerciseMediaPickerProps) {
  const showToast = useUIStore((s) => s.showToast);

  const [mode, setMode] = useState<MxMode>(initialMode(value));
  const [inicio, setInicio] = useState(value.imgInicio ?? null);
  const [fim, setFim] = useState(value.imgFim ?? null);
  const [uploading, setUploading] = useState<Record<ImageSlotKey, boolean>>({ inicio: false, fim: false });
  const [ytInput, setYtInput] = useState(() => {
    const id = idFromEmbedUrl(value.ytVideoUrl);
    return id ? `https://youtu.be/${id}` : value.ytVideoUrl ?? '';
  });
  const [ytId, setYtId] = useState<string | null>(idFromEmbedUrl(value.ytVideoUrl));

  function emit(patch: Partial<{ mode: MxMode; inicio: string | null; fim: string | null; ytId: string | null }>) {
    const m = patch.mode ?? mode;
    const i = 'inicio' in patch ? patch.inicio! : inicio;
    const f = 'fim' in patch ? patch.fim! : fim;
    const y = 'ytId' in patch ? patch.ytId! : ytId;

    if (m === 'img') onChange({ imgInicio: i, imgFim: f, ytVideoUrl: null });
    else if (m === 'yt') onChange({ imgInicio: null, imgFim: null, ytVideoUrl: y ? embedUrlFromId(y) : null });
    else onChange({ imgInicio: null, imgFim: null, ytVideoUrl: null });
  }

  function handleSetMode(m: MxMode) {
    setMode(m);
    emit({ mode: m });
  }

  async function handleFileChange(key: ImageSlotKey, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('⚠️ Selecione um arquivo de imagem.', 'warning');

    const objectUrl = URL.createObjectURL(file);
    if (key === 'inicio') setInicio(objectUrl);
    else setFim(objectUrl);
    setUploading((u) => ({ ...u, [key]: true }));

    try {
      const url = await uploadExerciseImage(exerciseId, key, file);
      URL.revokeObjectURL(objectUrl);
      if (key === 'inicio') setInicio(url);
      else setFim(url);
      emit({ [key]: url } as Partial<{ inicio: string | null; fim: string | null }>);
    } catch (err) {
      console.error('ExerciseMediaPicker: falha ao enviar imagem', err);
      URL.revokeObjectURL(objectUrl);
      if (key === 'inicio') setInicio(null);
      else setFim(null);
      showToast('⚠️ Não foi possível enviar a imagem. Tente novamente.', 'error');
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  }

  async function handleRemoveImage(e: MouseEvent, key: ImageSlotKey) {
    e.preventDefault();
    e.stopPropagation();
    if (key === 'inicio') setInicio(null);
    else setFim(null);
    emit({ [key]: null } as Partial<{ inicio: string | null; fim: string | null }>);
    deleteExerciseImage(exerciseId, key).catch(() => {});
  }

  function handleYtInput(raw: string) {
    setYtInput(raw);
    const id = extractYoutubeId(raw);
    setYtId(id);
    emit({ ytId: id });
  }

  const ytHasText = ytInput.trim().length > 0;

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label>
        🎬 Mídia do Exercício{' '}
        <span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--text-3)' }}>(opcional — imagens ou vídeo)</span>
      </label>

      <div className="mx-tabs">
        <div className={`mx-tab${mode === 'none' ? ' mx-tab-active' : ''}`} onClick={() => handleSetMode('none')}>
          Nenhuma
        </div>
        <div className={`mx-tab${mode === 'img' ? ' mx-tab-active' : ''}`} onClick={() => handleSetMode('img')}>
          🖼️ Imagens
        </div>
        <div className={`mx-tab${mode === 'yt' ? ' mx-tab-active' : ''}`} onClick={() => handleSetMode('yt')}>
          ▶️ YouTube
        </div>
      </div>

      <div className={`mx-mode${mode === 'img' ? ' mx-mode-active' : ''}`}>
        <div className="mx-img-row">
          {(['inicio', 'fim'] as const).map((key) => {
            const src = key === 'inicio' ? inicio : fim;
            return (
              <label className="mx-img-slot" key={key}>
                <input type="file" accept="image/*" onChange={(e) => handleFileChange(key, e.target.files?.[0])} />
                {src && <img className="mx-img-preview" src={src} alt={key === 'inicio' ? 'Posição inicial' : 'Posição final'} />}
                {!src && (
                  <span className="mx-img-placeholder">
                    📷
                    <br />
                    {key === 'inicio' ? 'Posição Inicial' : 'Posição Final'}
                  </span>
                )}
                {src && !uploading[key] && (
                  <button type="button" className="mx-img-remove" onClick={(e) => handleRemoveImage(e, key)} aria-label="Remover imagem">
                    ✕
                  </button>
                )}
                {uploading[key] && (
                  <div className="mx-img-uploading">
                    <div className="mx-img-spinner" />
                    Enviando…
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className={`mx-mode${mode === 'yt' ? ' mx-mode-active' : ''}`}>
        <input
          type="text"
          placeholder="Cole o link do YouTube (ex: https://youtu.be/...)"
          style={{ fontSize: '0.82rem' }}
          value={ytInput}
          onChange={(e) => handleYtInput(e.target.value)}
        />
        <div className={`mx-yt-preview${ytId ? ' mx-yt-preview-show' : ''}`}>
          {ytId && <img src={thumbnailUrlFromId(ytId)} alt="Prévia do vídeo" />}
          <div className="mx-yt-play">▶</div>
        </div>
        <div className={`mx-yt-status${ytId ? ' mx-yt-ok' : ytHasText ? ' mx-yt-err' : ''}`}>
          {ytId ? '✅ Vídeo identificado' : ytHasText ? '⚠️ Link do YouTube inválido' : ''}
        </div>
      </div>
    </div>
  );
}
