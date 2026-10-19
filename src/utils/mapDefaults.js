/** Fallback map center when GPS / cache unavailable (KL area — fine for manual testing). */
export const DEFAULT_MAP_CENTER = {
  lat: 3.139,
  lng: 101.6869,
};

export function withMapFallback(lat, lng) {
  const hasLat = typeof lat === 'number' && !Number.isNaN(lat);
  const hasLng = typeof lng === 'number' && !Number.isNaN(lng);
  return {
    lat: hasLat ? lat : DEFAULT_MAP_CENTER.lat,
    lng: hasLng ? lng : DEFAULT_MAP_CENTER.lng,
    usedFallback: !(hasLat && hasLng),
  };
}
