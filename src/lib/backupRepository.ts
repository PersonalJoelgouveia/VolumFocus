import { db, doc, getDoc, setDoc } from './firebase';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useCalorieStore } from '../store/useCalorieStore';
import { useProgressStore } from '../store/useProgressStore';
import { useAlunoStore } from '../store/useAlunoStore';
import { useHistoricoStore } from '../store/useHistoricoStore';
import { useRotinaStore } from '../store/useRotinaStore';
import { useStrengthStore } from '../store/useStrengthStore';
import { useAchievementStore } from '../store/useAchievementStore';
import { useCardioTestStore } from '../store/useCardioTestStore';
import { useCardioGoalStore } from '../store/useCardioGoalStore';

/**
 * Camada repository de backup — sucessora de vfAuth._pullBackup()/
 * _uploadBackup() (index.html ~7674-7707, BACKUP_KEYS ~7283). O original
 * lia/gravava um array de chaves cruas do localStorage; aqui, como cada
 * pedaço de estado já vive numa store Zustand própria (várias já
 * consolidando o que no monolito eram múltiplas chaves — ver comentários
 * em useWorkoutStore/useAchievementStore), o payload é montado lendo
 * `.getState()` de cada uma. Documento: `backups/{email}` no Firestore —
 * mesma coleção do original.
 *
 * IMPORTANTE — requer regra no Firestore (mesmo espírito das já
 * publicadas para `alunos`/`notificacoesTreinos`):
 *   match /backups/{email} {
 *     allow read, write: if request.auth != null
 *       && request.auth.token.email.lower() == email;
 *   }
 * Cada usuário (Personal ou aluno) só lê/escreve o próprio backup —
 * nunca o de outra pessoa.
 */

export interface BackupPayload {
  version: 2;
  savedAt: string;
  workout: {
    weekLog: ReturnType<typeof useWorkoutStore.getState>['weekLog'];
    selectedLevel: ReturnType<typeof useWorkoutStore.getState>['selectedLevel'];
    weekPSE: ReturnType<typeof useWorkoutStore.getState>['weekPSE'];
    exDone: ReturnType<typeof useWorkoutStore.getState>['exDone'];
  };
  exercises: ReturnType<typeof useExerciseStore.getState>['exercises'];
  calorie: {
    bodyWeightKg: ReturnType<typeof useCalorieStore.getState>['bodyWeightKg'];
    met: ReturnType<typeof useCalorieStore.getState>['met'];
    isActive: ReturnType<typeof useCalorieStore.getState>['isActive'];
  };
  progress: { loadHistory: ReturnType<typeof useProgressStore.getState>['loadHistory'] };
  alunos: ReturnType<typeof useAlunoStore.getState>['alunos'];
  historico: ReturnType<typeof useHistoricoStore.getState>['semanas'];
  rotinas: ReturnType<typeof useRotinaStore.getState>['rotinas'];
  strength: ReturnType<typeof useStrengthStore.getState>['records'];
  achievements: {
    streaks: ReturnType<typeof useAchievementStore.getState>['streaks'];
    records: ReturnType<typeof useAchievementStore.getState>['records'];
    fire: ReturnType<typeof useAchievementStore.getState>['fire'];
  };
  cardioTests: ReturnType<typeof useCardioTestStore.getState>['testes'];
  cardioGoal: { metaMin: ReturnType<typeof useCardioGoalStore.getState>['metaMin'] };
}

function backupDocRef(email: string) {
  return doc(db, 'backups', email.toLowerCase());
}

/**
 * Todas as chaves de localStorage persistidas localmente pelo app —
 * sucessor de BACKUP_KEYS (index.html ~7283), usado tanto para saber o
 * que existe quanto para limpar o dispositivo num logout com "apagar
 * dados locais" (ver useAuthStore.logout()).
 */
export const LOCAL_STORAGE_KEYS = [
  'jg3_log',
  'jg3_ex',
  'jg3_met_peso',
  'jg3_carga_progresso',
  'jg3_alunos',
  'historico_semanas',
  'jg3_rotinas',
  'jg3_strength_records',
  'jg3_conquistas',
  'jg3_cardio_data',
  'jg3_cardio_meta',
  'jg3_dirty',
];

/** Lê o estado atual de todas as stores locais persistidas — sucessor de BACKUP_KEYS. */
export function collectBackupPayload(): BackupPayload {
  const w = useWorkoutStore.getState();
  const cal = useCalorieStore.getState();
  const ach = useAchievementStore.getState();

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    workout: { weekLog: w.weekLog, selectedLevel: w.selectedLevel, weekPSE: w.weekPSE, exDone: w.exDone },
    exercises: useExerciseStore.getState().exercises,
    calorie: { bodyWeightKg: cal.bodyWeightKg, met: cal.met, isActive: cal.isActive },
    progress: { loadHistory: useProgressStore.getState().loadHistory },
    alunos: useAlunoStore.getState().alunos,
    historico: useHistoricoStore.getState().semanas,
    rotinas: useRotinaStore.getState().rotinas,
    strength: useStrengthStore.getState().records,
    achievements: { streaks: ach.streaks, records: ach.records, fire: ach.fire },
    cardioTests: useCardioTestStore.getState().testes,
    cardioGoal: { metaMin: useCardioGoalStore.getState().metaMin },
  };
}

/** Escreve o payload nas stores locais — sucessor da parte de restauração de _pullBackup(). */
export function hydrateFromBackup(payload: BackupPayload): void {
  useWorkoutStore.setState({
    weekLog: payload.workout.weekLog,
    selectedLevel: payload.workout.selectedLevel,
    weekPSE: payload.workout.weekPSE,
    exDone: payload.workout.exDone,
  });
  if (payload.exercises) useExerciseStore.setState({ exercises: payload.exercises });
  if (payload.calorie) useCalorieStore.setState(payload.calorie);
  if (payload.progress) useProgressStore.setState({ loadHistory: payload.progress.loadHistory });
  if (payload.alunos) useAlunoStore.setState({ alunos: payload.alunos });
  if (payload.historico) useHistoricoStore.setState({ semanas: payload.historico });
  if (payload.rotinas) useRotinaStore.setState({ rotinas: payload.rotinas });
  if (payload.strength) useStrengthStore.setState({ records: payload.strength });
  if (payload.achievements) useAchievementStore.setState(payload.achievements);
  if (payload.cardioTests) useCardioTestStore.setState({ testes: payload.cardioTests });
  if (payload.cardioGoal) useCardioGoalStore.setState(payload.cardioGoal);
}

/** Envia o payload atual para `backups/{email}` — sucessor de _uploadBackup(). */
export async function uploadBackup(email: string, payload: BackupPayload): Promise<boolean> {
  if (!email || !email.includes('@')) {
    console.error('uploadBackup: e-mail inválido');
    return false;
  }
  try {
    await setDoc(backupDocRef(email), payload);
    return true;
  } catch (e) {
    console.error('uploadBackup: falha ao gravar no Firestore', e);
    return false;
  }
}

/** Busca o backup salvo para um e-mail — sucessor de _pullBackup(). */
export async function fetchBackup(email: string): Promise<BackupPayload | null> {
  if (!email || !email.includes('@')) return null;
  const snap = await getDoc(backupDocRef(email));
  if (!snap.exists()) return null;
  return snap.data() as BackupPayload;
}
