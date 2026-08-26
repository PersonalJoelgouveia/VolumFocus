import { useUIStore } from '../store/useUIStore';
import { Sidebar } from '../components/nav/Sidebar';
import { BottomNav } from '../components/nav/BottomNav';
import { ImportWorkoutModal } from '../components/modals/ImportWorkoutModal';
import { AddExerciseModal } from '../components/modals/AddExerciseModal';
import { CloneDayModal } from '../components/registro/CloneDayModal';
import { ExecutionModal } from '../components/registro/ExecutionModal';
import { ToastContainer } from '../components/feedback/ToastContainer';
import { TimerEngine } from '../components/timer/TimerEngine';
import { FloatingTimerWidget } from '../components/timer/FloatingTimerWidget';
import { TimerConfirmModal } from '../components/timer/TimerConfirmModal';
import { MetWeightModal } from '../components/timer/MetWeightModal';
import { ProgressPopup } from '../components/analytics/ProgressPopup';
import { VIEW_META } from '../types/view';

import { RegistroView } from '../views/RegistroView';
import { DashboardView } from '../views/DashboardView';
import { BancoView } from '../views/BancoView';
import { ForcaView } from '../views/ForcaView';
import { CardioView } from '../views/CardioView';
import { PerformanceView } from '../views/PerformanceView';
import { NovaSemanaView } from '../views/NovaSemanaView';
import { ConquistasView } from '../views/ConquistasView';
import { ClientesView } from '../views/ClientesView';
import { NotificationsView } from '../views/NotificationsView';

import './AppShell.css';

/**
 * Shell principal — sucessor da composição estática Sidebar + bottom-nav +
 * #app-main + troca de `.view` por classList (index.html ~2421-2620,
 * switchView() ~4398). Aqui a troca de view é 100% controlada por estado
 * (useUIStore.activeView), sem manipulação direta de DOM.
 */
const VIEW_COMPONENTS = {
  registro: RegistroView,
  dashboard: DashboardView,
  banco: BancoView,
  forca: ForcaView,
  cardio: CardioView,
  performance: PerformanceView,
  'nova-semana': NovaSemanaView,
  conquistas: ConquistasView,
  clientes: ClientesView,
  notifications: NotificationsView,
} as const;

export function AppShell() {
  const activeView = useUIStore((s) => s.activeView);
  const meta = VIEW_META[activeView];
  const ActiveViewComponent = VIEW_COMPONENTS[activeView];

  return (
    <div id="app-shell">
      <Sidebar />

      <div id="app-main">
        <header className="app-header">
          <div className="hdr-title">{meta.title}</div>
          <div className="hdr-sub">{meta.sub}</div>
        </header>

        <main className="app-content">
          <ActiveViewComponent />
        </main>
      </div>

      <BottomNav />
      <ImportWorkoutModal />
      <AddExerciseModal />
      <CloneDayModal />
      <ExecutionModal />
      <ToastContainer />

      {/* Cronômetro global — montado uma única vez, sobrevive a troca de view. */}
      <TimerEngine />
      <FloatingTimerWidget />
      <TimerConfirmModal />
      <MetWeightModal />
      <ProgressPopup />
    </div>
  );
}
