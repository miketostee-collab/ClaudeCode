import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  addProject,
  deleteProject,
  exportData,
  importData,
  listObservations,
  listProjects,
  localDate,
  renameProject,
} from '../db';
import { signIn, signOut, syncAvailable, syncNow, useAccount } from '../account';
import { download, toCSV, toGeoJSON, toGPX } from '../export';
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
            Signed in as <strong>{a.email}</strong>. Your observations are saved to your account and appear on every
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
              if (confirm('Sign out? Your data stays on this device, but stops syncing.')) void signOut();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="small">
            Sign in to back up your observations and use them on your laptop and phone. Without signing in, everything
            stays on this device.
          </p>
          <button className="primary" onClick={() => void signIn()}>
            Sign in with Google
          </button>
        </>
      )}
      {a.error && (
        <div className="error" role="alert">
          {a.error}
        </div>
      )}
    </section>
  );
}

function ProjectsCard() {
  const projects = useLiveQuery(() => listProjects(), []);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="card stack">
      <div className="card-kicker">Projects</div>
      {projects?.length === 0 && <p className="muted small">Projects group observations by trip or study area.</p>}
      <ul className="plain-list">
        {projects?.map((p) => (
          <li key={p.id} className="list-row">
            <span className="row-main">{p.name}</span>
            <button
              className="link"
              onClick={() => {
                const n = prompt('Rename project', p.name);
                if (n !== null) void run(() => renameProject(p.id, n));
              }}
            >
              Rename
            </button>
            <button
              className="link danger-text"
              onClick={() => {
                if (confirm(`Delete “${p.name}”? Its observations are kept, just no longer in a project.`)) {
                  void run(() => deleteProject(p.id));
                }
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await addProject({ name });
            setName('');
          });
        }}
      >
        <input className="text-input" placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="secondary shrink" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}

export default function SettingsScreen() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const account = useAccount();

  async function exportAs(kind: 'geojson' | 'gpx' | 'csv') {
    const [observations, projects] = await Promise.all([listObservations(), listProjects()]);
    if (observations.length === 0) {
      setStatus({ ok: false, text: 'Nothing to export yet.' });
      return;
    }
    const day = localDate();
    if (kind === 'geojson') download(`geo-${day}.geojson`, JSON.stringify(toGeoJSON(observations, projects), null, 2), 'application/geo+json');
    if (kind === 'gpx') download(`geo-${day}.gpx`, toGPX(observations, projects), 'application/gpx+xml');
    if (kind === 'csv') download(`geo-${day}.csv`, toCSV(observations, projects), 'text/csv');
    setStatus({ ok: true, text: `Exported ${observations.length} observations.` });
  }

  async function doBackup() {
    const data = await exportData();
    download(`geo-backup-${localDate()}.json`, JSON.stringify(data, null, 2), 'application/json');
    setStatus({ ok: true, text: `Backed up ${data.observations.length} observations.` });
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await file.text());
      const where = account.email ? ' and in your account on every synced device' : '';
      if (!confirm(`Restoring replaces everything currently in the app${where} with the backup. Continue?`)) return;
      const r = await importData(data);
      setStatus({ ok: true, text: `Restored ${r.projects} projects and ${r.observations} observations.` });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof SyntaxError ? 'That file is not valid JSON.' : (err as Error).message });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="stack">
      <AccountCard />
      <ProjectsCard />

      <section className="card stack">
        <div className="card-kicker">Export for mapping and GIS</div>
        <p className="muted small">Opens in QGIS, Google Earth, spreadsheets and most GPS apps.</p>
        <div className="row">
          <button className="secondary" onClick={() => void exportAs('geojson')}>
            GeoJSON
          </button>
          <button className="secondary" onClick={() => void exportAs('gpx')}>
            GPX
          </button>
          <button className="secondary" onClick={() => void exportAs('csv')}>
            CSV
          </button>
        </div>
      </section>

      <section className="card stack">
        <div className="card-kicker">Backup</div>
        <p className="muted small">
          {account.email
            ? 'Your data is saved to your account. You can still keep a copy as a file.'
            : 'Your data lives only on this device. Back it up now and then: clearing browser data or removing the app erases it.'}
        </p>
        <button className="primary" onClick={() => void doBackup()}>
          Back up to a file
        </button>
        <button className="secondary" onClick={() => fileRef.current?.click()}>
          Restore from a backup…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])}
        />
        {status && (
          <div className={status.ok ? 'success' : 'error'} role="status">
            {status.text}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="card-kicker">Install on your phone</div>
        <p className="small">
          <strong>iPhone (Safari):</strong> tap Share, then “Add to Home Screen”. Open it from the home screen and allow
          location when asked.
        </p>
        <p className="muted small">
          GPS only runs while the app is open on screen. Once installed it opens full screen and works offline (maps need
          a connection).
        </p>
      </section>

      <p className="muted small center">App version: {__APP_BUILD__}</p>
    </div>
  );
}
