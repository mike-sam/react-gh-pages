const CITY_KMH = 30;

export function estimateDriveMinutes(km) {
  const d = Number(km);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.max(1, Math.round((d / CITY_KMH) * 60));
}

export function formatDriveMin(min) {
  const n = Math.max(0, Math.round(Number(min) || 0));
  if (!n) return '';
  if (n < 60) return `${n} 分`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} 時 ${m} 分` : `${h} 時`;
}

export async function fetchDriveMinutes(from, to, signal) {
  const aLat = Number(from?.lat);
  const aLng = Number(from?.lng);
  const bLat = Number(to?.lat);
  const bLng = Number(to?.lng);
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) {
    throw new Error('缺座標');
  }
  const url =
    `https://router.project-osrm.org/route/v1/driving/${aLng},${aLat};${bLng},${bLat}` +
    '?overview=false&annotations=false';
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const sec = Number(data?.routes?.[0]?.duration);
  if (!Number.isFinite(sec) || sec < 0) throw new Error('沒有車程');
  return Math.max(1, Math.round(sec / 60));
}
