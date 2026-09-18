import { useEffect, useRef, useState } from 'react';
import { useWearableStore } from '../../store/useWearableStore';
import type { WearableScope, WearableWorkoutSession } from '../../lib/wearables';
import { MetricCard } from '../../components/dashboard/MetricCard';
import '../SaudeView.css';

const ALL_SCOPES: WearableScope[] = ['heartRate', 'restingHeartRate', 'steps', 'distance', 'calories', 'sessions'];

const PLATFORM_LABEL: Record<'android' | 'ios' | 'web', string> = {
  android: 'Google Health Connect',
  ios: 'Apple Health',
  web: 'Navegador',
};

const PLATFORM_ICON: Record<'android' | 'ios' | 'web', string> = {
  android: '🤖',
  ios: '🍏',
  web: '🌐',
};

interface Snapshot {
  heartRate: number | null;
  restingHeartRate: number | null;
  steps: number | null;
  distanceKm: number | null;
  calories: number | null;
  sessions: WearableWorkoutSession[];
}

type DataState = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

function last24h() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Último valor por timestamp — readSamples não garante ordem. */
function latestBpm(samples: { timestamp: string; bpm: number }[]): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((a, b) => (a.timestamp > b.timestamp ? a : b)).bpm;
}

function sumBy<T>(items: T[], pick: (item: T) => number): number | null {
  if (items.length === 0) return null;
  return items.reduce((acc, item) => acc + pick(item), 0);
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'nunca';
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `hoje às ${time}` : `${date.toLocaleDateString('pt-BR')} às ${time}`;
}

/**
 * Aba "Wearables" do módulo Saúde — camada de UI sobre o core já pronto
 * (useWearableStore → WearableService → HealthConnectProvider /
 * HealthKitProvider / WebFallbackProvider). Não duplica nada do módulo
 * Cardio: métricas aqui são as normalizadas do wearable (FC, passos,
 * distância, calorias ativas, sessões), não os testes de VO2 Máx nem o
 * registro manual de treino cardio, que continuam só em Cardio/Registro.
 * Nenhuma amostra bruta é persistida — cada "Sincronizar agora" busca de
 * novo (mesma decisão de privacidade documentada na store).
 *
 * Extraída de `SaudeView.tsx` (que virou o hub Saúde com abas) sem
 * qualquer mudança de lógica — só o nome do componente e os caminhos de
 * import relativos (`../` → `../../`), pra caber em `views/saude/`.
 */
export function WearablesPanel() {
  const platform = useWearableStore((s) => s.platform);
  const available = useWearableStore((s) => s.available);
  const permissionsGranted = useWearableStore((s) => s.permissionsGranted);
  const connStatus = useWearableStore((s) => s.status);
  const lastSyncAt = useWearableStore((s) => s.lastSyncAt);
  const errorMessage = useWearableStore((s) => s.errorMessage);
  const checkAvailability = useWearableStore((s) => s.checkAvailability);
  const requestPermissions = useWearableStore((s) => s.requestPermissions);
  const fetchHeartRate = useWearableStore((s) => s.fetchHeartRate);
  const fetchRestingHeartRate = useWearableStore((s) => s.fetchRestingHeartRate);
  const fetchSteps = useWearableStore((s) => s.fetchSteps);
  const fetchDistance = useWearableStore((s) => s.fetchDistance);
  const fetchCalories = useWearableStore((s) => s.fetchCalories);
  const fetchSessions = useWearableStore((s) => s.fetchSessions);

  const [dataState, setDataState] = useState<DataState>('idle');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const autoSyncedRef = useRef(false);

  const isWeb = platform === 'web';
  const isBusy = connStatus === 'checking' || connStatus === 'syncing' || dataState === 'loading';

  const badge: 'connected' | 'disconnected' | 'syncing' | 'error' | 'unsupported' = isWeb
    ? 'unsupported'
    : connStatus === 'error'
      ? 'error'
      : isBusy
        ? 'syncing'
        : available && permissionsGranted
          ? 'connected'
          : 'disconnected';

  const badgeLabel = (
    {
      connected: 'Conectado',
      disconnected: 'Desconectado',
      syncing: 'Sincronizando',
      error: 'Erro',
      unsupported: 'Não disponível',
    } as Record<typeof badge, string>
  )[badge];

  async function handleSync() {
    setDataState('loading');
    await checkAvailability();

    const state = useWearableStore.getState();
    if (!state.available) {
      setDataState('empty');
      setSnapshot(null);
      return;
    }

    let granted = state.permissionsGranted;
    if (!granted) {
      granted = await requestPermissions(ALL_SCOPES);
    }

    if (useWearableStore.getState().status === 'error') {
      setDataState('error');
      return;
    }

    if (!granted) {
      setDataState('empty');
      setSnapshot(null);
      return;
    }

    const range = last24h();
    const [hr, rhr, steps, distance, calories, sessions] = await Promise.all([
      fetchHeartRate(range),
      fetchRestingHeartRate(range),
      fetchSteps(range),
      fetchDistance(range),
      fetchCalories(range),
      fetchSessions(range),
    ]);

    const next: Snapshot = {
      heartRate: latestBpm(hr),
      restingHeartRate: latestBpm(rhr),
      steps: sumBy(steps, (s) => s.steps),
      distanceKm: sumBy(distance, (d) => d.meters) != null ? (sumBy(distance, (d) => d.meters) as number) / 1000 : null,
      calories: sumBy(calories, (c) => c.kcal),
      sessions,
    };

    const isEmpty =
      next.heartRate == null &&
      next.restingHeartRate == null &&
      next.steps == null &&
      next.distanceKm == null &&
      next.calories == null &&
      next.sessions.length === 0;

    setSnapshot(next);
    setDataState(isEmpty ? 'empty' : 'loaded');
  }

  useEffect(() => {
    checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoSyncedRef.current && !isWeb && available && permissionsGranted) {
      autoSyncedRef.current = true;
      handleSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, permissionsGranted, isWeb]);

  return (
    <div className="sd-view">
      <div className="sd-conn-card">
        <div className="sd-conn-top">
          <div className="sd-conn-icon">{PLATFORM_ICON[platform]}</div>
          <div className="sd-conn-info">
            <div className="sd-conn-platform">{PLATFORM_LABEL[platform]}</div>
            <div className="sd-conn-sync">Última sincronização: {formatSyncTime(lastSyncAt)}</div>
          </div>
          <span className={`sd-status sd-status-${badge}`} role="status" aria-live="polite">
            <span className="sd-status-dot" aria-hidden="true" />
            {badgeLabel}
          </span>
        </div>

        {isWeb ? (
          <div className="sd-neutral-txt" style={{ textAlign: 'left' }}>
            Sincronização com wearables não está disponível pelo navegador — instale o app no Android (Health
            Connect) ou iOS (Apple Health) pra ver seus dados aqui.
          </div>
        ) : (
          <button
            type="button"
            className={`sd-conn-cta${badge === 'error' ? ' sd-cta-retry' : ''}`}
            onClick={handleSync}
            disabled={isBusy}
            aria-busy={isBusy}
          >
            {isBusy && <span className="sd-spinner" aria-hidden="true" />}
            {isBusy
              ? 'Sincronizando…'
              : badge === 'error'
                ? 'Tentar novamente'
                : badge === 'connected'
                  ? 'Sincronizar agora'
                  : `Conectar ${platform === 'android' ? 'Health Connect' : 'Apple Health'}`}
          </button>
        )}
      </div>

      {!isWeb && (
        <>
          <div className="sd-section-title">Últimas 24h</div>

          {dataState === 'loading' && (
            <div className="grid-auto" aria-busy="true" aria-label="Carregando dados de saúde">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="sd-skel-card" key={i} aria-hidden="true">
                  <div className="sd-skel-line sd-skel-sm" />
                  <div className="sd-skel-line sd-skel-lg" />
                </div>
              ))}
            </div>
          )}

          {dataState === 'error' && (
            <div className="sd-neutral-card sd-neutral-error" role="alert">
              <div className="sd-neutral-ico">⚠️</div>
              <div className="sd-neutral-txt">{errorMessage ?? 'Não foi possível buscar os dados agora.'}</div>
            </div>
          )}

          {dataState === 'empty' && (
            <div className="sd-neutral-card">
              <div className="sd-neutral-ico">📭</div>
              <div className="sd-neutral-txt">
                {permissionsGranted
                  ? 'Nenhum dado encontrado nas últimas 24h.'
                  : 'Conceda acesso pra ver seus dados de saúde aqui.'}
              </div>
            </div>
          )}

          {dataState === 'idle' && (
            <div className="sd-neutral-card">
              <div className="sd-neutral-ico">⌚</div>
              <div className="sd-neutral-txt">Toque em "Conectar" pra buscar seus dados de saúde.</div>
            </div>
          )}

          {dataState === 'loaded' && snapshot && (
            <div className="grid-auto">
              <MetricCard icon="❤️" label="Frequência Cardíaca" value={snapshot.heartRate ?? '—'} unit={snapshot.heartRate != null ? 'bpm' : undefined} />
              <MetricCard
                icon="💤"
                label="FC em Repouso"
                value={snapshot.restingHeartRate ?? '—'}
                unit={snapshot.restingHeartRate != null ? 'bpm' : undefined}
              />
              <MetricCard
                icon="👣"
                label="Passos"
                value={snapshot.steps != null ? snapshot.steps.toLocaleString('pt-BR') : '—'}
                unit={snapshot.steps != null ? 'passos' : undefined}
              />
              <MetricCard
                icon="📍"
                label="Distância"
                value={snapshot.distanceKm != null ? snapshot.distanceKm.toFixed(1) : '—'}
                unit={snapshot.distanceKm != null ? 'km' : undefined}
              />
              <MetricCard
                icon="🔥"
                label="Calorias Ativas"
                value={snapshot.calories != null ? Math.round(snapshot.calories) : '—'}
                unit={snapshot.calories != null ? 'kcal' : undefined}
              />
              <MetricCard
                icon="🏃"
                label="Atividade"
                value={snapshot.sessions.length}
                unit="sessões"
                footer={
                  snapshot.sessions.length > 0 ? (
                    <div className="sd-metric-footer">{[...new Set(snapshot.sessions.map((s) => s.activityType))].join(', ')}</div>
                  ) : undefined
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
