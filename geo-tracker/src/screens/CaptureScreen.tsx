import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addObservation, addProject, listProjects } from '../db';
import { accuracyLevel, formatAccuracy, formatCoords, useGps } from '../geo';
import { useCurrentProject } from '../prefs';
import ObservationForm, { emptyForm, formToFields, type FormValues } from './ObservationForm';

export default function CaptureScreen({ onToast }: { onToast: (msg: string) => void }) {
  const gps = useGps(true);
  const projects = useLiveQuery(() => listProjects(), []);
  const [currentProject, setCurrentProject] = useCurrentProject();
  const [form, setForm] = useState<FormValues>(() => emptyForm(currentProject));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!projects) return <p className="muted">Loading…</p>;
  // Forget a remembered project that was deleted.
  const projectId = projects.some((p) => p.id === form.projectId) ? form.projectId : '';
  const fix = gps.fix;
  const level = fix ? accuracyLevel(fix.accuracy) : null;

  async function save() {
    if (!fix) return;
    setSaving(true);
    setError(null);
    try {
      await addObservation({
        ...formToFields({ ...form, projectId }),
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        ...(fix.altitude != null ? { altitude: fix.altitude } : {}),
      });
      setCurrentProject(projectId);
      // Keep the project and type for the next stop; clear the rest.
      setForm({ ...emptyForm(projectId), type: form.type });
      onToast('Recorded');
      gps.restart();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function newProject() {
    const name = prompt('Project name');
    if (!name?.trim()) return;
    try {
      const id = await addProject({ name });
      setForm((f) => ({ ...f, projectId: id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="stack">
      <section className={`card gps ${level ?? gps.status}`} aria-live="polite">
        <div className="card-kicker">GPS position</div>
        {fix ? (
          <>
            <div className="coords">{formatCoords(fix.lat, fix.lng)}</div>
            <div className="gps-meta">
              <span className={`badge ${level}`}>{formatAccuracy(fix.accuracy)}</span>
              {fix.altitude != null && <span className="muted small">{Math.round(fix.altitude)} m elevation</span>}
            </div>
            {level === 'poor' && (
              <p className="small warn">Accuracy is low. Wait a few seconds, or move to open sky, for a better fix.</p>
            )}
          </>
        ) : gps.status === 'denied' || gps.status === 'unavailable' ? (
          <p className="error small" role="alert">
            {gps.error}
          </p>
        ) : (
          <p className="muted">Looking for a GPS signal…</p>
        )}
        <button className="link left" onClick={gps.restart}>
          Take a fresh fix
        </button>
      </section>

      <section className="card">
        <ObservationForm
          value={{ ...form, projectId }}
          onChange={setForm}
          projects={projects}
          onNewProject={() => void newProject()}
        />
      </section>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button className="primary big-action" onClick={() => void save()} disabled={!fix || saving}>
        {fix ? 'Record here' : 'Waiting for GPS…'}
      </button>
    </div>
  );
}
