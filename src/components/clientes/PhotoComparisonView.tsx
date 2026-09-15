import { useEffect, useRef, useState } from 'react';
import type { PhysicalAssessment } from '../../types/assessment';
import { PHOTO_POSES, getPhotoObjectUrl, type PhotoPose } from '../../lib/assessmentPhotoStore';
import './PhotoComparisonView.css';

/** Rótulos específicos deste seletor — "Perfil D/E" como pedido aqui,
 *  mesmo o FotosComparativas usando "Lado direito/esquerdo" na captura. */
const POSE_LABELS: Record<PhotoPose, string> = {
  front: 'Frente',
  back: 'Costas',
  rightSide: 'Perfil D',
  leftSide: 'Perfil E',
};

type Aba = PhotoPose | 'todas';

const ABAS: Array<{ key: Aba; label: string }> = [
  { key: 'front', label: 'Frente' },
  { key: 'back', label: 'Costas' },
  { key: 'rightSide', label: 'Perfil D' },
  { key: 'leftSide', label: 'Perfil E' },
  { key: 'todas', label: 'Todas' },
];

interface PhotoComparisonViewProps {
  anterior: PhysicalAssessment;
  atual: PhysicalAssessment;
}

/**
 * Visualização documental — sem filtro de beleza, retoque ou alteração de
 * proporção. Só exibe exatamente o que foi capturado (ver FotosComparativas
 * / assessmentPhotoStore.ts), lado a lado (desktop) ou empilhado (mobile,
 * via CSS). "Zoom" é um lightbox simples (ver a foto ampliada) — sem
 * biblioteca de pinch-zoom, suficiente pro objetivo comparativo.
 */
export function PhotoComparisonView({ anterior, atual }: PhotoComparisonViewProps) {
  const [aba, setAba] = useState<Aba>('todas');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const urlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    (async () => {
      const pares = await Promise.all(
        PHOTO_POSES.flatMap((pose) => [
          getPhotoObjectUrl(anterior.id, pose).then((u) => [chave(anterior.id, pose), u] as const),
          getPhotoObjectUrl(atual.id, pose).then((u) => [chave(atual.id, pose), u] as const),
        ])
      );
      if (cancelado) return;
      const mapa: Record<string, string> = {};
      for (const [k, url] of pares) if (url) mapa[k] = url;
      setUrls(mapa);
      setCarregando(false);
    })();
    return () => {
      cancelado = true;
      Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [anterior.id, atual.id]);

  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  function chave(assessmentId: string, pose: PhotoPose): string {
    return `${assessmentId}_${pose}`;
  }

  const posesParaExibir = aba === 'todas' ? PHOTO_POSES : [aba];
  const temAlgumaFoto = Object.keys(urls).length > 0;

  return (
    <div className="pcv-wrapper">
      <div className="pcv-datas">
        <span>{new Date(anterior.date).toLocaleDateString('pt-BR')}</span>
        <span className="pcv-datas-vs">×</span>
        <span>{new Date(atual.date).toLocaleDateString('pt-BR')}</span>
      </div>

      <div className="pcv-tabs">
        {ABAS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pcv-tab${aba === t.key ? ' active' : ''}`}
            onClick={() => setAba(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="pcv-empty">Carregando fotos…</div>
      ) : !temAlgumaFoto ? (
        <div className="pcv-empty">Esta avaliação não possui fotos comparativas.</div>
      ) : (
        <div className={`pcv-grid${aba === 'todas' ? ' pcv-grid--todas' : ''}`}>
          {posesParaExibir.map((pose) => {
            const urlAnterior = urls[chave(anterior.id, pose)];
            const urlAtual = urls[chave(atual.id, pose)];
            if (!urlAnterior && !urlAtual) return null;
            return (
              <div key={pose} className="pcv-par">
                <div className="pcv-par-titulo">{POSE_LABELS[pose]}</div>
                <div className="pcv-par-fotos">
                  <div className="pcv-foto-col">
                    {urlAnterior ? (
                      <img
                        src={urlAnterior}
                        alt={`${POSE_LABELS[pose]} — avaliação anterior`}
                        onClick={() => setAmpliada(urlAnterior)}
                      />
                    ) : (
                      <div className="pcv-foto-vazia">Sem foto</div>
                    )}
                    <span className="pcv-foto-legenda">Anterior</span>
                  </div>
                  <div className="pcv-foto-col">
                    {urlAtual ? (
                      <img
                        src={urlAtual}
                        alt={`${POSE_LABELS[pose]} — avaliação atual`}
                        onClick={() => setAmpliada(urlAtual)}
                      />
                    ) : (
                      <div className="pcv-foto-vazia">Sem foto</div>
                    )}
                    <span className="pcv-foto-legenda">Atual</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ampliada && (
        <div className="pcv-lightbox" onClick={() => setAmpliada(null)} role="dialog" aria-label="Foto ampliada">
          <img src={ampliada} alt="Foto ampliada" />
        </div>
      )}
    </div>
  );
}
