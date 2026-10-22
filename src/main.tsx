import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initLang } from './i18n';

initLang();

// For scripts/screen-check.mjs: stand in the iPhone's safe area, which the
// emulator has none of. ?safe=left,right,top,bottom in px.
const safe = new URLSearchParams(location.search).get('safe');
if (safe) {
  const [l, r, t, b] = safe.split(',').map(Number);
  const st = document.documentElement.style;
  st.setProperty('--sal', `${l || 0}px`);
  st.setProperty('--sar', `${r || 0}px`);
  st.setProperty('--sat', `${t || 0}px`);
  st.setProperty('--sab', `${b || 0}px`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
