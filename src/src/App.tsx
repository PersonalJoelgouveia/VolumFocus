import { AuthGate } from './components/auth/AuthGate';
import { AppShell } from './views/AppShell';

function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

export default App;
