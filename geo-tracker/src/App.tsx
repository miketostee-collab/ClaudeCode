import { lazy, Suspense, useEffect, useState } from 'react';
import CaptureScreen from './screens/CaptureScreen';
import ListScreen from './screens/ListScreen';
import ObservationDetail from './screens/ObservationDetail';
import SettingsScreen from './screens/SettingsScreen';

// Leaflet is only downloaded when the map is opened.
const MapScreen = lazy(() => import('./screens/MapScreen'));

type Tab = 'record' | 'map' | 'list' | 'settings';

const TABS: { id: Tab; label: string; title: string; icon: string }[] = [
  { id: 'record', label: 'Record', title: 'Record', icon: '◎' },
  { id: 'map', label: 'Map', title: 'Map', icon: '⌖' },
  { id: 'list', label: 'List', title: 'Observations', icon: '☰' },
  { id: 'settings', label: 'Settings', title: 'Settings', icon: '⋯' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('record');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const close = () => setOpenId(null);

  return (
    <div className="app">
      <header className="topbar">
        <h1>{openId ? 'Observation' : TABS.find((t) => t.id === tab)!.title}</h1>
      </header>
      <main className={tab === 'map' && !openId ? 'content wide' : 'content'}>
        {openId ? (
          <ObservationDetail id={openId} onClose={close} />
        ) : tab === 'record' ? (
          <CaptureScreen onToast={setToast} />
        ) : tab === 'map' ? (
          <Suspense fallback={<p className="muted">Loading map…</p>}>
            <MapScreen onOpen={setOpenId} />
          </Suspense>
        ) : tab === 'list' ? (
          <ListScreen onOpen={setOpenId} />
        ) : (
          <SettingsScreen />
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'tab active' : 'tab'}
            onClick={() => {
              setTab(t.id);
              close();
            }}
            aria-current={t.id === tab ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
