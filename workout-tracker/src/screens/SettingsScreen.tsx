import { useRef, useState } from 'react';
import { exportData, importData, localDate, type Unit } from '../db';
import { signIn, signOut, syncAvailable, syncNow, useAccount } from '../account';
import { relativeTime } from '../prefs';

function AccountCard() {
  const a = useAccount();
  if (!syncAvailable) return null;
  return (
    <section className="card stack">
      <div className="card-kicker">Sync across devices</div>
      {a.loading ? (
        <p className="muted small">Checking sign-in…</p>
      ) : a.email ? (
        <>
          <p className="small">
            Signed in as <strong>{a.email}</strong>. Your workouts are saved to your account and appear on every
            device where you sign in.
          </p>
          <p className="muted small" role="status">
            {a.syncing ? 'Syncing…' : a.lastSyncedAt ? `Last synced ${relativeTime(a.lastSyncedAt)}.` : 'Not synced yet.'}
          </p>
          <button className="secondary" onClick={() => void syncNow()} disabled={a.syncing}>
            Sync now
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (confirm('Sign out? Your data stays on this phone, but stops syncing.')) void signOut();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="small">
            Optional. Sign in to back up your workouts and use them on other devices. Without signing in, everything
            stays on this phone.
          </p>
          <button className="primary" onClick={() => void signIn()}>
            Sign in with Google
          </button>
        </>
      )}
      {a.error && <div className="error" role="alert">{a.error}</div>}
    </section>
  );
}

export default function SettingsScreen({ unit, onUnit }: { unit: Unit; onUnit: (u: Unit) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const account = useAccount();

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
      const where = account.email ? ' and in your account on every synced device' : '';
      if (!confirm(`Importing replaces everything currently in the app${where} with the backup. Continue?`)) return;
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
      <AccountCard />

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
          {account.email
            ? 'Your data is saved to your account. You can still export a copy as a file.'
            : 'Your data lives only on this phone. Export a backup now and then, because clearing browser data or uninstalling the app will erase it.'}
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

      <p className="muted small center">App version: {__APP_BUILD__}</p>
    </div>
  );
}
