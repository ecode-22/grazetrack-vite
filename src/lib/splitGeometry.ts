import { bbox } from '@turf/bbox';
import { bboxPolygon } from '@turf/bbox-polygon';
import { feature, featureCollection } from '@turf/helpers';
import { intersect } from '@turf/intersect';
import { calcAreaHa } from './geo';
import type { FieldGeometry } from './types';

export type SplitDirection = 'balanced' | 'vertical' | 'horizontal';

function clipToBounds(geometry: FieldGeometry, bounds: [number, number, number, number]): FieldGeometry | null {
  const clipped = intersect(featureCollection([feature(geometry as any), bboxPolygon(bounds)]));
  if (!clipped || (clipped.geometry.type !== 'Polygon' && clipped.geometry.type !== 'MultiPolygon')) return null;
  return clipped.geometry as FieldGeometry;
}

function splitAtArea(geometry: FieldGeometry, firstCount: number, totalCount: number, direction: 'vertical' | 'horizontal'):
  [FieldGeometry, FieldGeometry] | null {
  const boundary = feature(geometry as any);
  const [minX, minY, maxX, maxY] = bbox(boundary);
  const min = direction === 'vertical' ? minX : minY;
  const max = direction === 'vertical' ? maxX : maxY;
  const totalArea = calcAreaHa(geometry);
  if (!Number.isFinite(max - min) || max <= min || totalArea <= 0) return null;

  function areaBefore(coordinate: number): number {
    const bounds: [number, number, number, number] = direction === 'vertical'
      ? [minX, minY, coordinate, maxY]
      : [minX, minY, maxX, coordinate];
    const clipped = clipToBounds(geometry, bounds);
    return clipped ? calcAreaHa(clipped) : 0;
  }

  const targetArea = totalArea * firstCount / totalCount;
  let lower = min;
  let upper = max;
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (areaBefore(midpoint) < targetArea) lower = midpoint;
    else upper = midpoint;
  }
  const cut = (lower + upper) / 2;
  const firstBounds: [number, number, number, number] = direction === 'vertical'
    ? [minX, minY, cut, maxY]
    : [minX, minY, maxX, cut];
  const secondBounds: [number, number, number, number] = direction === 'vertical'
    ? [cut, minY, maxX, maxY]
    : [minX, cut, maxX, maxY];
  const first = clipToBounds(geometry, firstBounds);
  const second = clipToBounds(geometry, secondBounds);
  return first && second ? [first, second] : null;
}

function splitBalanced(geometry: FieldGeometry, count: number): FieldGeometry[] {
  if (count <= 1) return [geometry];
  const [minX, minY, maxX, maxY] = bbox(feature(geometry as any));
  const midLatitude = (minY + maxY) / 2;
  const width = (maxX - minX) * Math.cos(midLatitude * Math.PI / 180);
  const height = maxY - minY;
  const axis = width >= height ? 'vertical' : 'horizontal';
  const firstCount = Math.ceil(count / 2);
  const halves = splitAtArea(geometry, firstCount, count, axis);
  if (!halves) return [geometry];
  return [
    ...splitBalanced(halves[0], firstCount),
    ...splitBalanced(halves[1], count - firstCount),
  ];
}

export function splitBoundary(geometry: FieldGeometry, count: number, direction: SplitDirection): FieldGeometry[] {
  if (!Number.isInteger(count) || count < 2 || count > 16) return [];
  if (direction === 'balanced') {
    const camps = splitBalanced(geometry, count);
    return camps.length === count && camps.every((camp) => calcAreaHa(camp) >= 0.01) ? camps : [];
  }

  const boundary = feature(geometry as any);
  const [minX, minY, maxX, maxY] = bbox(boundary);
  const min = direction === 'vertical' ? minX : minY;
  const max = direction === 'vertical' ? maxX : maxY;
  const length = max - min;
  const totalArea = calcAreaHa(geometry);
  if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(totalArea) || totalArea <= 0 || !Number.isInteger(count) || count < 2) return [];

  function areaBefore(coordinate: number): number {
    const bounds: [number, number, number, number] = direction === 'vertical'
      ? [minX, minY, coordinate, maxY]
      : [minX, minY, maxX, coordinate];
    const clipped = clipToBounds(geometry, bounds);
    return clipped ? calcAreaHa(clipped) : 0;
  }

  const cuts = [min];
  for (let index = 1; index < count; index += 1) {
    const targetArea = (totalArea * index) / count;
    let lower = min;
    let upper = max;
    for (let iteration = 0; iteration < 30; iteration += 1) {
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
    const bounds: [number, number, number, number] = direction === 'vertical'
      ? [lower, minY, upper, maxY]
      : [minX, lower, maxX, upper];
    const camp = clipToBounds(geometry, bounds);
    if (!camp) continue;
    if (calcAreaHa(camp) >= 0.01) camps.push(camp);
  }
  return camps;
}