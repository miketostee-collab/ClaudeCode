import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startAccount } from './account';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Installed apps can stay open for days; check for a new version each time it comes to the front.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  });
}

// Ask the browser not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => {});

void startAccount();
