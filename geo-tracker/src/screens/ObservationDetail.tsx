import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { deleteObservation, getObservation, listProjects, updateObservation, type Observation } from '../db';
import { formatAccuracy, formatCoords } from '../geo';
import { formatWhen } from '../prefs';
import ObservationForm, { formToFields, type FormValues } from './ObservationForm';

const toForm = (o: Observation): FormValues => ({
  projectId: o.projectId ?? '',
  type: o.type,
  rockType: o.rockType ?? '',
  formation: o.formation ?? '',
  description: o.description ?? '',
  sampleId: o.sampleId ?? '',
  strike: o.strike != null ? String(o.strike) : '',
  dip: o.dip != null ? String(o.dip) : '',
  dipDirection: o.dipDirection ?? '',
  notes: o.notes ?? '',
});

export default function ObservationDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const obs = useLiveQuery(() => getObservation(id), [id]);
  const projects = useLiveQuery(() => listProjects(), []);
  const [form, setForm] = useState<FormValues | null>(null);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Load the form once, from the first copy of the row (later live updates don't overwrite typing).
  useEffect(() => {
    if (obs && !form) {
      setForm(toForm(obs));
      setLat(String(obs.lat));
      setLng(String(obs.lng));
    }
  }, [obs, form]);

  if (obs === undefined || !projects || (obs && !form)) return <p className="muted">Loading…</p>;
  if (!obs || !form) {
    return (
      <div className="stack">
        <p>This observation no longer exists.</p>
        <button className="secondary" onClick={onClose}>
          Back
        </button>
      </div>
    );
  }

  async function save() {
    if (!form) return;
    setError(null);
    try {
      const nlat = Number(lat);
      const nlng = Number(lng);
      if (lat.trim() === '' || lng.trim() === '' || !Number.isFinite(nlat) || !Number.isFinite(nlng)) {
        throw new Error('Enter the latitude and longitude as numbers.');
      }
      await updateObservation(id, { ...formToFields(form, true), lat: nlat, lng: nlng });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove() {
    if (!confirm('Delete this observation? It will also be removed from your other devices.')) return;
    await deleteObservation(id);
    onClose();
  }

  return (
    <div className="stack">
      <button className="link left" onClick={onClose}>
        ‹ Back
      </button>
      <section className="card stack">
        <div className="card-kicker">Position</div>
        <div className="coords">{formatCoords(obs.lat, obs.lng)}</div>
        <p className="muted small">
          {formatWhen(obs.recordedAt)}
          {obs.accuracy != null && ` · ${formatAccuracy(obs.accuracy)}`}
          {obs.altitude != null && ` · ${Math.round(obs.altitude)} m elevation`}
        </p>
        <div className="row">
          <label className="field">
            <span className="label">Latitude</span>
            <input className="text-input" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Longitude</span>
            <input className="text-input" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </label>
        </div>
        <p className="muted small">Edit the position only to correct a poor fix.</p>
      </section>
      <section className="card">
        <ObservationForm value={form} onChange={setForm} projects={projects} />
      </section>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button className="primary" onClick={() => void save()}>
        Save changes
      </button>
      <button className="danger" onClick={() => void remove()}>
        Delete observation
      </button>
    </div>
  );
}
