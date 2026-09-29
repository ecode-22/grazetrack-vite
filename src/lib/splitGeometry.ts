import { bbox } from '@turf/bbox';
import { bboxPolygon } from '@turf/bbox-polygon';
import { feature, featureCollection } from '@turf/helpers';
import { intersect } from '@turf/intersect';
import { calcAreaHa } from './geo';
import type { FieldGeometry } from './types';

export function splitBoundary(geometry: FieldGeometry, count: number, direction: 'vertical' | 'horizontal'): FieldGeometry[] {
  const boundary = feature(geometry as any);
  const [minX, minY, maxX, maxY] = bbox(boundary);
  const min = direction === 'vertical' ? minX : minY;
  const max = direction === 'vertical' ? maxX : maxY;
  const length = max - min;
  if (!Number.isFinite(length) || length <= 0) return [];
  const totalArea = calcAreaHa(geometry);
  if (!Number.isFinite(totalArea) || totalArea <= 0 || !Number.isInteger(count) || count < 2) return [];

  function areaBefore(coordinate: number): number {
    const cell = direction === 'vertical'
      ? bboxPolygon([minX, minY, coordinate, maxY])
      : bboxPolygon([minX, minY, maxX, coordinate]);
    const clipped = intersect(featureCollection([boundary as any, cell as any]));
    return clipped ? calcAreaHa(clipped.geometry as FieldGeometry) : 0;
  }

  const cuts = [min];
  for (let index = 1; index < count; index += 1) {
    const targetArea = (totalArea * index) / count;
    let lower = min;
    let upper = max;
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const midpoint = (lower + upper) / 2;
      if (areaBefore(midpoint) < targetArea) lower = midpoint;
      else upper = midpoint;
    }
    cuts.push((lower + upper) / 2);
  }
  cuts.push(max);

  const camps: FieldGeometry[] = [];
  for (let index = 0; index < cuts.length - 1; index += 1) {
    const lower = cuts[index];
    const upper = cuts[index + 1];
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