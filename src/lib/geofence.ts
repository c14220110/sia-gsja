/**
 * Geolocation & Geofencing utilities (adapted from odoo-attendance-pwa/lib/geofence.ts)
 * Uses the Haversine formula to compute great-circle distance between two GPS coordinates in meters.
 */

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== "number" ||
    typeof lon1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lon2 !== "number" ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Infinity;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

export interface SatelitGeofence {
  id: number;
  kode_satelit: string;
  nama_satelit: string;
  gps_location: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meter: number;
}

export interface NearestSatelitResult {
  satelit: SatelitGeofence | null;
  distanceMeters: number;
  isWithinRadius: boolean;
}

export function findNearestSatelit(
  lat: number,
  lng: number,
  satelitList: SatelitGeofence[]
): NearestSatelitResult {
  let best: SatelitGeofence | null = null;
  let bestDist = Infinity;
  let matched: SatelitGeofence | null = null;
  let matchedDist = Infinity;

  for (const s of satelitList) {
    if (s.latitude == null || s.longitude == null) continue;
    const dist = calculateDistanceMeters(lat, lng, Number(s.latitude), Number(s.longitude));
    const radius = Number(s.radius_meter) || 100;
    if (dist <= radius && dist < matchedDist) {
      matched = s;
      matchedDist = dist;
    }
    if (dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }

  if (matched) {
    return { satelit: matched, distanceMeters: Math.round(matchedDist), isWithinRadius: true };
  }

  return {
    satelit: best,
    distanceMeters: Number.isFinite(bestDist) ? Math.round(bestDist) : Infinity,
    isWithinRadius: false,
  };
}
