import { useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useThemeStore } from '../store/useThemeStore';
import { UserMenu } from '../components/auth/UserMenu';
import { Sidebar } from '../components/nav/Sidebar';
import { MobileSidebar } from '../components/nav/MobileSidebar';
import logoBlue from '../assets/brand/joel-gouveia-symbol-blue.png';
import logoWhite from '../assets/brand/joel-gouveia-symbol-white.png';
import { ImportWorkoutModal } from '../components/modals/ImportWorkoutModal';
import { AddExerciseModal } from '../components/modals/AddExerciseModal';
import { CloneDayModal } from '../components/registro/CloneDayModal';
import { ExecutionModal } from '../components/registro/ExecutionModal';
import { RotinasModal } from '../components/registro/RotinasModal';
import { ToastContainer } from '../components/feedback/ToastContainer';
import { ConfirmDialog } from '../components/feedback/ConfirmDialog';
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
import { SettingsView } from '../views/SettingsView';
import { useSyncStore } from '../store/useSyncStore';

import './AppShell.css';

/**
 * Shell principal — sucessor da composição estática Sidebar + bottom-nav +
 * #app-main + troca de `.view` por classList (index.html ~2421-2620,
 * switchView() ~4398). Aqui a troca de view é 100% controlada por estado
 * (useUIStore.activeView), sem manipulação direta de DOM. A bottom-nav
 * mobile foi substituída pela MobileSidebar (drawer retrátil icon-only,
 * ver components/nav/MobileSidebar.tsx) — a Sidebar desktop continua igual.
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
  settings: SettingsView,
} as const;

export function AppShell() {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);
  const isPersonalMode = useUIStore((s) => s.isPersonalMode);
  const isAlunoMode = useUIStore((s) => s.isAlunoMode);
  const theme = useThemeStore((s) => s.theme);
  const meta = VIEW_META[activeView];

  // Restringe views `ptOnly`/`alunoOnly` a cada papel — reforço em nível de
  // renderização, além do já existente esconder os botões de nav
  // (Sidebar/BottomNav só listam PT_NAV/ALUNO_NAV conforme o papel). Cobre
  // o caso de `activeView` ficar com uma view restrita selecionada de uma
  // sessão anterior (ex.: PT sai e um aluno loga no mesmo dispositivo).
  const isBlocked = (meta.ptOnly && !isPersonalMode) || (meta.alunoOnly && !isAlunoMode);

  useEffect(() => {
    if (isBlocked) setActiveView('registro');
  }, [isBlocked, setActiveView]);

  const safeView = isBlocked ? 'registro' : activeView;
  const safeMeta = VIEW_META[safeView];
  const ActiveViewComponent = VIEW_COMPONENTS[safeView];

  // AppShell só renderiza com status==='granted' (ver AuthGate) — momento
  // seguro pra ligar os watchers de auto-sync uma única vez por sessão.
  useEffect(() => {
    useSyncStore.getState().init();
  }, []);

  return (
    <div id="app-shell">
      <Sidebar />

      <div id="app-main">
        <header className="app-header">
          <div className="hdr-title-row">
            {/* Logo só existe na Sidebar desktop (escondida <=860px) — sem isso
                o header mobile fica sem marca. Escondida em desktop via CSS. */}
            <div className="hdr-brand">
              <img
                className="hdr-brand-logo"
                src={theme === 'dark' ? logoWhite : logoBlue}
                alt="Joel Gouveia"
                width={36}
                height={36}
              />
              <div className="hdr-brand-text">
                <div className="hdr-title">{safeMeta.title}</div>
                <div className="hdr-sub">{safeMeta.sub}</div>
              </div>
            </div>
            <UserMenu />
          </div>
        </header>

        <main className="app-content">
          <ActiveViewComponent />
        </main>
      </div>

      <MobileSidebar />
      <ImportWorkoutModal />
      <AddExerciseModal />
      <CloneDayModal />
      <ExecutionModal />
      <RotinasModal />
      <ToastContainer />
      <ConfirmDialog />

      {/* Cronômetro global — montado uma única vez, sobrevive a troca de view. */}
      <TimerEngine />
      <FloatingTimerWidget />
      <TimerConfirmModal />
      <MetWeightModal />
      <ProgressPopup />
    </div>
  );
}
