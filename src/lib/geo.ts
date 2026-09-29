// ============================================================
//  geo.ts — ported 1:1 from the original app's calcAreaHa() so field
//  areas compute identically (same WGS84 spherical approximation, not
//  a full geodesic library).
// ============================================================

export function calcAreaHa(geometry: { type: string; coordinates: any }): number {
  if (!geometry) return 0;
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce(
      (sum: number, ring: any) => sum + calcAreaHa({ type: 'Polygon', coordinates: ring }),
      0,
    );
  }
  if (geometry.type !== 'Polygon') return 0;

  const coords = geometry.coordinates[0];
  const R = 6378137; // WGS84 Earth radius (m)
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i];
    const p2 = coords[i + 1];
    area += (p2[0] - p1[0]) * (2 + Math.sin((p1[1] * Math.PI) / 180) + Math.sin((p2[1] * Math.PI) / 180));
  }
  return (Math.abs(area) * R * R * Math.PI) / (360 * 10000); // → hectares
}
