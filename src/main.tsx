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

// The viewport, explicitly: iOS does not always resize a fixed body after
// a rotation, and a sheet laid out from the stale width overflowed
// sideways. Every resize, orientation change and visual-viewport change
// writes the live size onto the root, twice (iOS reports the old size at
// the moment of the orientation event), and scrolls open sheets to the top.
function fitViewport(): void {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const h = Math.round(vv?.height ?? window.innerHeight);
  const root = document.getElementById('root')!;
  root.style.width = `${w}px`;
  root.style.height = `${h}px`;
  document.documentElement.style.setProperty('--vw', `${w}px`);
  document.documentElement.style.setProperty('--vh', `${h}px`);
  for (const el of document.querySelectorAll<HTMLElement>('.overlay, .screen')) el.scrollTop = 0;
}
for (const ev of ['resize', 'orientationchange']) {
  window.addEventListener(ev, () => {
    fitViewport();
    setTimeout(fitViewport, 300);
  });
}
window.visualViewport?.addEventListener('resize', fitViewport);
fitViewport();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
