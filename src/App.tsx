import { AuthGate } from './components/auth/AuthGate';
import { OfflineBanner } from './components/auth/OfflineBanner';
import { AppShell } from './views/AppShell';

function App() {
  return (
    <AuthGate>
      <OfflineBanner />
      <AppShell />
    </AuthGate>
  );
}

export default App;
