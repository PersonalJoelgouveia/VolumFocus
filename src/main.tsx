import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/layout.css';
import './index.css';
import App from './App.tsx';
import { initTheme } from './store/useThemeStore';
import { initLocale } from './store/useLocaleStore';

initTheme();
initLocale();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
