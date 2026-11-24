import { useRef, useState } from 'react';
import { exportData, importData, localDate, type Unit } from '../db';

export default function SettingsScreen({ unit, onUnit }: { unit: Unit; onUnit: (u: Unit) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function doExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-backup-${localDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus({ ok: true, text: `Exported ${data.entries.length} entries.` });
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Importing replaces everything currently in the app with the backup. Continue?')) return;
      const r = await importData(data);
      setStatus({ ok: true, text: `Restored ${r.exercises} exercises and ${r.entries} entries.` });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof SyntaxError ? 'That file is not valid JSON.' : (err as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="card-kicker">Weight unit</div>
        <div className="segmented" role="radiogroup" aria-label="Weight unit">
          {(['lb', 'kg'] as Unit[]).map((u) => (
            <button key={u} role="radio" aria-checked={unit === u} className={unit === u ? 'seg active' : 'seg'} onClick={() => onUnit(u)}>
              {u}
            </button>
          ))}
        </div>
        <p className="muted small">New entries use this unit. Past entries keep the unit they were logged in.</p>
      </section>

      <section className="card stack">
        <div className="card-kicker">Backup</div>
        <p className="muted small">
          Your data lives only on this phone. Export a backup now and then, because clearing browser data or
          uninstalling the app will erase it.
        </p>
        <button className="primary" onClick={doExport}>Export backup</button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>Import backup…</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
        />
        {status && <div className={status.ok ? 'success' : 'error'} role="status">{status.text}</div>}
      </section>

      <section className="card stack">
        <div className="card-kicker">Install on your phone</div>
        <p className="small">
          <strong>iPhone (Safari):</strong> tap Share, then “Add to Home Screen”.
          <br />
          <strong>Android (Chrome):</strong> tap ⋮, then “Install app” or “Add to Home screen”.
        </p>
        <p className="muted small">Once installed it opens full screen and works offline.</p>
      </section>
    </div>
  );
}
