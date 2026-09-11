import { useEffect, useRef, useState } from 'react';
import { useWearableStore } from '../store/useWearableStore';
import { useCardioTestStore } from '../store/useCardioTestStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { isCardioLogEntry } from '../types/workout';
import type { HeartRateSample, WearableWorkoutSession } from '../lib/wearables';
import {
  bucketTimeInZones,
  cardioActivityLabel,
  currentWeekRange,
  dayIndexOfDate,
  isCardioActivityType,
  markDuplicates,
  type WearableCardioSession,
} from '../utils/wearableCardio';

export interface WearableCardioWeek {
  /** false em Web ou sem permissão concedida — Cardio funciona 100% igual
   *  ao baseline nesse caso (nenhum elemento novo aparece na tela). Conectar
   *  continua sendo papel exclusivo da tela Saúde & Wearables; este hook só
   *  lê o que já foi autorizado/sincronizado por lá. */
  connected: boolean;
  loading: boolean;
  sessions: WearableCardioSession[];
  /** Soma de duração das sessões NÃO duplicadas — o que entra na meta semanal. */
  extraMinutes: number;
  totalCalories: number;
}

export function useWearableCardioWeek(): WearableCardioWeek {
  const platform = useWearableStore((s) => s.platform);
  const available = useWearableStore((s) => s.available);
  const permissionsGranted = useWearableStore((s) => s.permissionsGranted);
  const lastSuccessfulSyncAt = useWearableStore((s) => s.lastSuccessfulSyncAt);
  const getLocalHistory = useWearableStore((s) => s.getLocalHistory);
  const syncNow = useWearableStore((s) => s.syncNow);
  const checkAvailability = useWearableStore((s) => s.checkAvailability);

  const weekLog = useWorkoutStore((s) => s.weekLog);

  const connected = platform !== 'web' && available && permissionsGranted;
  const [sessions, setSessions] = useState<WearableCardioSession[]>([]);
  const [loading, setLoading] = useState(false);
  const autoSyncedRef = useRef(false);

  useEffect(() => {
    checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronização silenciosa em segundo plano — uma vez por sessão do app,
  // só quando já há conexão prévia. Nunca pede permissão nem mostra erro
  // aqui; isso é exclusivo da SaudeView.
  useEffect(() => {
    if (connected && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      void syncNow(['sessions', 'heartRate']);
    }
  }, [connected, syncNow]);

  useEffect(() => {
    if (!connected) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const range = currentWeekRange();
      const records = await getLocalHistory('sessions', range);
      const raw = records
        .map((r) => r.payload as WearableWorkoutSession)
        .filter((s) => isCardioActivityType(s.activityType));

      const zones = useCardioTestStore.getState().testes[0]?.zones ?? null;

      const built = await Promise.all(
        raw.map(async (s): Promise<Omit<WearableCardioSession, 'isDuplicate'>> => {
          const durationMin = Math.max(0, Math.round((s.end.getTime() - s.start.getTime()) / 60000));
          let avgHr: number | null = s.avgHeartRate ?? null;
          let maxHr: number | null = null;
          let zoneTimes: WearableCardioSession['zoneTimes'] = null;

          try {
            const hrRecords = await getLocalHistory('heartRate', { start: s.start, end: s.end });
            const bpmSamples = hrRecords.map((r) => r.payload as HeartRateSample);
            if (bpmSamples.length > 0) {
              avgHr = avgHr ?? Math.round(bpmSamples.reduce((acc, x) => acc + x.bpm, 0) / bpmSamples.length);
              maxHr = Math.round(Math.max(...bpmSamples.map((x) => x.bpm)));
              if (zones) zoneTimes = bucketTimeInZones(bpmSamples, zones);
            }
          } catch {
            // Sem FC detalhada pra essa sessão específica — segue só com o
            // que a sessão trouxe (ou nada); nunca derruba a lista inteira.
          }

          return {
            id: s.id,
            dayIndex: dayIndexOfDate(s.start),
            start: s.start,
            activityType: s.activityType,
            label: cardioActivityLabel(s.activityType),
            durationMin,
            avgHr,
            maxHr,
            calories: s.calories ?? null,
            zoneTimes,
          };
        })
      );

      const manualDurationsByDay: Record<number, number[]> = {};
      for (let d = 0; d < 7; d++) {
        manualDurationsByDay[d] = (weekLog[d] ?? []).filter(isCardioLogEntry).map((e) => e.duration || 0);
      }

      const withDup = markDuplicates(built, manualDurationsByDay).sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );

      if (!cancelled) {
        setSessions(withDup);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, lastSuccessfulSyncAt, getLocalHistory, weekLog]);

  const extraMinutes = sessions.filter((s) => !s.isDuplicate).reduce((acc, s) => acc + s.durationMin, 0);
  const totalCalories = sessions.reduce((acc, s) => acc + (s.calories ?? 0), 0);

  return { connected, loading, sessions, extraMinutes, totalCalories };
}
