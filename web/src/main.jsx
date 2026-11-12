import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { FitCoachProvider } from './state.jsx';
import './styles.css';

createRoot(document.querySelector('#app')).render(
  <StrictMode>
    <FitCoachProvider><App /></FitCoachProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
