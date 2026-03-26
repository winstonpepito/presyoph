/** Bounding box around a point for OSM embed zoom (~block level). */
const BBOX_HALF_DEG = 0.0035

/**
 * Build OpenStreetMap embed URL: bbox = minLng, minLat, maxLng, maxLat; marker = lat, lng.
 */
export function openStreetMapEmbedUrl(latitude: number, longitude: number): string {
  const minLng = longitude - BBOX_HALF_DEG
  const minLat = latitude - BBOX_HALF_DEG
  const maxLng = longitude + BBOX_HALF_DEG
  const maxLat = latitude + BBOX_HALF_DEG
  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`
  const marker = `${latitude},${longitude}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`
}

export function openStreetMapViewUrl(latitude: number, longitude: number, zoom = 18): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`
}

export function hasUsableMapCoords(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (latitude === 0 && longitude === 0) return false
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false
  return true
}
