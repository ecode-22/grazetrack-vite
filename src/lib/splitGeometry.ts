import { bbox } from '@turf/bbox';
import { bboxPolygon } from '@turf/bbox-polygon';
import { feature, featureCollection } from '@turf/helpers';
import { intersect } from '@turf/intersect';
import { calcAreaHa } from './geo';
import type { FieldGeometry } from './types';

export function splitBoundary(geometry: FieldGeometry, count: number, direction: 'vertical' | 'horizontal'): FieldGeometry[] {
  const boundary = feature(geometry as any);
  const [minX, minY, maxX, maxY] = bbox(boundary);
  const length = direction === 'vertical' ? maxX - minX : maxY - minY;
  if (!Number.isFinite(length) || length <= 0) return [];

  const camps: FieldGeometry[] = [];
  for (let index = 0; index < count; index += 1) {
    const lower = direction === 'vertical' ? minX + (length * index) / count : minY + (length * index) / count;
    const upper = direction === 'vertical' ? minX + (length * (index + 1)) / count : minY + (length * (index + 1)) / count;
    const cell = direction === 'vertical'
      ? bboxPolygon([lower, minY, upper, maxY])
      : bboxPolygon([minX, lower, maxX, upper]);
    const clipped = intersect(featureCollection([boundary as any, cell as any]));
    if (!clipped || (clipped.geometry.type !== 'Polygon' && clipped.geometry.type !== 'MultiPolygon')) continue;
    const camp = clipped.geometry as FieldGeometry;
    if (calcAreaHa(camp) >= 0.01) camps.push(camp);
  }
  return camps;
}