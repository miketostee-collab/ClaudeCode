import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { listObservations, listProjects } from '../db';
import { formatCoords, formatStrikeDip } from '../geo';
import { observationName } from '../export';
import { formatWhen } from '../prefs';

/** Pin colour per observation type. */
const COLORS: Record<string, string> = {
  outcrop: '#fb923c',
  sample: '#38bdf8',
  structure: '#a78bfa',
  note: '#94a3b8',
};

export default function MapScreen({ onOpen }: { onOpen: (id: string) => void }) {
  const observations = useLiveQuery(() => listObservations(), []);
  const projects = useLiveQuery(() => listProjects(), []);
  const [projectId, setProjectId] = useState('');
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  // The project filter the view was last zoomed for, so a sync doesn't re-zoom while you pan.
  const fittedFor = useRef<string | null>(null);
  const open = useRef(onOpen);
  open.current = onOpen;

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  // Draw the pins whenever the data or filter changes.
  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group || !observations) return;
    group.clearLayers();
    const shown = observations.filter((o) => !projectId || o.projectId === projectId);
    for (const o of shown) {
      const icon = L.divIcon({
        className: 'pin-wrap',
        html: `<span class="pin" style="background:${COLORS[o.type] ?? COLORS.note}"></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      // Popup content is built with text nodes, never HTML, since it holds user-typed notes.
      const box = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = observationName(o);
      const when = document.createElement('div');
      when.textContent = formatWhen(o.recordedAt);
      const where = document.createElement('div');
      where.textContent = formatCoords(o.lat, o.lng, 4);
      box.append(title, when, where);
      const sd = formatStrikeDip(o);
      if (sd) {
        const d = document.createElement('div');
        d.textContent = `Strike/dip ${sd}`;
        box.append(d);
      }
      const btn = document.createElement('button');
      btn.className = 'popup-btn';
      btn.textContent = 'Open';
      btn.onclick = () => open.current(o.id);
      box.append(btn);
      L.marker([o.lat, o.lng], { icon }).bindPopup(box).addTo(group);
    }
    if (shown.length && fittedFor.current !== projectId) {
      m.fitBounds(L.latLngBounds(shown.map((o) => [o.lat, o.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
      fittedFor.current = projectId;
    }
  }, [observations, projectId]);

  return (
    <div className="map-screen">
      <div className="map-bar">
        <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="muted small">{observations ? `${observations.length} total` : ''}</span>
      </div>
      <div ref={el} className="map" />
      {observations?.length === 0 && <p className="muted small center">No observations yet. Pins appear here once you record some.</p>}
    </div>
  );
}
