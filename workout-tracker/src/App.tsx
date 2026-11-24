import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listExercises } from './db';
import { useSelectedExercise, useUnit } from './prefs';
import LogScreen from './screens/LogScreen';
import HistoryScreen from './screens/HistoryScreen';
import ExercisesScreen from './screens/ExercisesScreen';
import SettingsScreen from './screens/SettingsScreen';

type Tab = 'log' | 'history' | 'exercises' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'log', label: 'Log', icon: '＋' },
  { id: 'history', label: 'History', icon: '☰' },
  { id: 'exercises', label: 'Exercises', icon: '⚙︎' },
  { id: 'settings', label: 'Settings', icon: '⋯' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('log');
  const [unit, setUnit] = useUnit();
  const [selectedId, setSelectedId] = useSelectedExercise();
  const exercises = useLiveQuery(() => listExercises(), []);

  // Fall back gracefully if the remembered exercise was deleted.
  const selected = exercises?.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="app">
      <header className="topbar">
        <h1>{TABS.find((t) => t.id === tab)!.label}</h1>
      </header>
      <main className="content">
        {exercises === undefined ? (
          <p className="muted">Loading…</p>
        ) : tab === 'log' ? (
          <LogScreen exercises={exercises} selected={selected} onSelect={setSelectedId} unit={unit} />
        ) : tab === 'history' ? (
          <HistoryScreen exercises={exercises} selected={selected} onSelect={setSelectedId} />
        ) : tab === 'exercises' ? (
          <ExercisesScreen exercises={exercises} />
        ) : (
          <SettingsScreen unit={unit} onUnit={setUnit} />
        )}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
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
