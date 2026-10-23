import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEFAULT_ZOOM, MapInvalidateOn, TILES } from './map/LeafletBits';
import { DEFAULT_MAP_CENTER } from '../utils/mapDefaults';
import { colorForTag, formatMoney, parseRecordCoords, recordTag } from '../utils/expenseSummary';
import { fromMyr } from '../utils/fxRates';

function FitPoints({ points, token }) {
  const map = useMap();
  useEffect(() => {
    const valid = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!valid.length) return;
    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], Math.max(map.getZoom() || DEFAULT_ZOOM, 15));
      return;
    }
    const b = L.latLngBounds(valid.map((p) => [p.lat, p.lng]));
    map.fitBounds(b.pad(0.18), { maxZoom: 16, animate: false });
  }, [token, map, points]);
  return null;
}

function HeatMapBody({ records, slices, cats, sub, fx }) {
  const wantCats = cats || [];
  const wantSub = String(sub || '').trim();
  const points = useMemo(() => {
    const out = [];
    (records || []).forEach((row, i) => {
      const xy = parseRecordCoords(row);
      if (!xy) return;
      const tag = recordTag(row);
      if (wantCats.length && !wantCats.includes(tag)) return;
      const title = String(row.title || '').trim();
      if (wantSub && title !== wantSub) return;
      out.push({
        ...xy,
        id: row.id || `${xy.lat},${xy.lng}-${i}`,
        tag,
        title,
        amount: Number(row.amount) || 0,
        description: String(row.description || '').trim(),
        color: colorForTag(tag, slices.findIndex((s) => s.tag === tag)),
      });
    });
    return out;
  }, [records, slices, wantCats, wantSub]);

  const blobs = useMemo(() => {
    const map = new Map();
    points.forEach((p) => {
      const k = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      const cur = map.get(k) || { lat: p.lat, lng: p.lng, w: 0, n: 0, color: p.color, sample: p };
      cur.w += p.amount;
      cur.n += 1;
      cur.sample = p;
      map.set(k, cur);
    });
    const maxN = Math.max(1, ...[...map.values()].map((b) => b.n));
    return [...map.values()].map((b) => ({
      ...b,
      r: 8 + Math.round((b.n / maxN) * 16),
    }));
  }, [points]);

  const fitToken = `${wantCats.join(',')}|${wantSub}|${points.length}`;

  return (
    <div className="expense-heat-map">
      <MapContainer
        center={[DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng]}
        zoom={14}
        maxZoom={19}
        zoomControl={false}
        className="expense-heat-leaflet"
      >
        <TileLayer url={TILES.street.url} attribution={TILES.street.attribution} />
        <ZoomControl position="bottomright" />
        <MapInvalidateOn token={fitToken} />
        <FitPoints points={points} token={fitToken} />
        {blobs.map((b) => (
          <CircleMarker
            key={`${b.lat},${b.lng}`}
            center={[b.lat, b.lng]}
            radius={b.r}
            pathOptions={{
              color: b.color,
              weight: 0,
              fillColor: b.color,
              fillOpacity: 0.38 + Math.min(0.4, b.n / 10),
            }}
          >
            <Popup>
              <strong>{b.sample.tag}</strong>
              {b.sample.title ? ` / ${b.sample.title}` : ''}
              <br />
              {b.n} 筆 · {formatMoney(fromMyr(b.w, fx))}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <span className="expense-heat-meta">{points.length} 點</span>
    </div>
  );
}

export default function ExpenseHeatMap({ records, slices, initialTags, fx }) {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState([]);
  const [sub, setSub] = useState('');

  const geoCount = useMemo(
    () => (records || []).reduce((n, r) => n + (parseRecordCoords(r) ? 1 : 0), 0),
    [records]
  );

  const subcats = useMemo(() => {
    const want = cats;
    const counts = {};
    (records || []).forEach((row) => {
      if (!parseRecordCoords(row)) return;
      if (want.length && !want.includes(recordTag(row))) return;
      const title = String(row.title || '').trim();
      if (!title) return;
      counts[title] = (counts[title] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([title, count]) => ({ title, count }));
  }, [records, cats]);

  const openMap = () => {
    setCats(Array.isArray(initialTags) ? initialTags.filter(Boolean) : initialTags ? [initialTags] : []);
    setSub('');
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="expense-heat-launch">
        <button type="button" className="expense-heat-open" onClick={openMap}>
          地圖
          <em>{geoCount}</em>
        </button>
      </div>
    );
  }

  return (
    <div className="expense-heat expense-heat-card">
      <div className="expense-heat-toolbar">
        <button type="button" className="expense-records-hide" onClick={() => setOpen(false)}>
          隱藏地圖
        </button>
        <div className="expense-records-filters">
          <button
            type="button"
            className={`expense-chip${cats.length === 0 ? ' is-on' : ''}`}
            onClick={() => {
              setCats([]);
              setSub('');
            }}
          >
            全部
          </button>
          {(slices || []).map((s) => (
            <button
              key={s.tag}
              type="button"
              className={`expense-chip${cats.includes(s.tag) ? ' is-on' : ''}`}
              onClick={() => {
                setCats((prev) =>
                  prev.includes(s.tag) ? prev.filter((t) => t !== s.tag) : [...prev, s.tag]
                );
                setSub('');
              }}
            >
              {s.tag}
            </button>
          ))}
        </div>
      </div>
      {subcats.length ? (
        <div className="expense-records-filters expense-heat-subs">
          <button
            type="button"
            className={`expense-chip${sub === '' ? ' is-on' : ''}`}
            onClick={() => setSub('')}
          >
            子分類
          </button>
          {subcats.map((s) => (
            <button
              key={s.title}
              type="button"
              className={`expense-chip${sub === s.title ? ' is-on' : ''}`}
              onClick={() => setSub((cur) => (cur === s.title ? '' : s.title))}
            >
              {s.title}
              <em>{s.count}</em>
            </button>
          ))}
        </div>
      ) : null}
      {!geoCount ? (
        <p className="expense-summary-status">這個月沒有經緯度。掃描報表後才會帶入。</p>
      ) : (
        <HeatMapBody records={records} slices={slices} cats={cats} sub={sub} fx={fx} />
      )}
    </div>
  );
}
