import { useEffect, useState } from 'react';
import { AuthGate } from './components/auth/AuthGate';
import { OfflineBanner } from './components/auth/OfflineBanner';
import { RelatorioLink } from './components/relatorio/RelatorioLink';
import { parseRelatorioHash } from './lib/relatorioShare';
import { AppShell } from './views/AppShell';

/** Link protegido: `#/relatorio/<id opaco>`. Só id de formato válido chega à tela (e ainda assim passa pelo login). */
function useRelatorioHash(): [string | null, () => void] {
  const [id, setId] = useState<string | null>(() => parseRelatorioHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setId(parseRelatorioHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const fechar = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setId(null);
  };
  return [id, fechar];
}

function App() {
  const [shareId, fecharRelatorio] = useRelatorioHash();
  return (
    <AuthGate>
      {shareId ? (
        <RelatorioLink shareId={shareId} onClose={fecharRelatorio} />
      ) : (
        <>
          <OfflineBanner />
          <AppShell />
        </>
      )}
    </AuthGate>
  );
}

export default App;
