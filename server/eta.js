const radians = degrees => Number(degrees) * Math.PI / 180;

export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const dLat = radians(Number(b.lat) - Number(a.lat));
  const dLng = radians(Number(b.lng) - Number(a.lng));
  const lat1 = radians(a.lat), lat2 = radians(b.lat);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

/**
 * Estimate the remaining travel time from the latest vehicle location to the
 * route's final stop. This deliberately uses a transparent average-speed model
 * instead of claiming road-routing accuracy when no routing provider is set.
 */
export function estimateEta(trip, stops, { averageSpeedKmh = 28 } = {}) {
  const ordered = [...(stops || [])].sort((a, b) => Number(a.stopOrder) - Number(b.stopOrder));
  const current = trip?.lat != null && trip?.lng != null ? { lat: Number(trip.lat), lng: Number(trip.lng) } : null;
  if (!ordered.length || !current) {
    const scheduledMinutes = trip?.arrivalTime ? Math.max(0, Math.round((Date.parse(trip.arrivalTime) - Date.now()) / 60000)) : null;
    return { etaMinutes: scheduledMinutes, distanceKmRemaining: null, nextStop: null, etaSource: scheduledMinutes == null ? 'unavailable' : 'schedule' };
  }
  let nextIndex = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < ordered.length; index++) {
    const value = distanceKm(current, ordered[index]);
    if (value != null && value < bestDistance) { bestDistance = value; nextIndex = index; }
  }
  let remaining = bestDistance === Infinity ? 0 : bestDistance;
  for (let index = nextIndex; index < ordered.length - 1; index++) remaining += distanceKm(ordered[index], ordered[index + 1]) || 0;
  const speed = Math.max(8, Number(averageSpeedKmh) || 28);
  const etaMinutes = Math.max(0, Math.ceil(remaining / speed * 60));
  return {
    etaMinutes,
    distanceKmRemaining: Math.round(remaining * 10) / 10,
    nextStop: ordered[nextIndex] ? { id: ordered[nextIndex].id, name: ordered[nextIndex].name, stopOrder: ordered[nextIndex].stopOrder } : null,
    etaSource: trip.locationSource === 'gps' ? 'gps-estimate' : 'simulation-estimate',
  };
}
