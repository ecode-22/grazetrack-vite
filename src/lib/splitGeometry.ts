import { bbox } from '@turf/bbox';
import { bboxPolygon } from '@turf/bbox-polygon';
import { feature, featureCollection } from '@turf/helpers';
import { intersect } from '@turf/intersect';
import { transformRotate } from '@turf/transform-rotate';
import { calcAreaHa } from './geo';
import type { FieldGeometry } from './types';

export type SplitDirection = 'balanced' | 'vertical' | 'horizontal';

function clipToBounds(geometry: FieldGeometry, bounds: [number, number, number, number]): FieldGeometry | null {
  const clipped = intersect(featureCollection([feature(geometry as any), bboxPolygon(bounds)]));
  if (!clipped || (clipped.geometry.type !== 'Polygon' && clipped.geometry.type !== 'MultiPolygon')) return null;
  return clipped.geometry as FieldGeometry;
}

function splitAtArea(geometry: FieldGeometry, firstWeight: number, totalWeight: number, direction: 'vertical' | 'horizontal'):
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

  const targetArea = totalArea * firstWeight / totalWeight;
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

function splitBalanced(geometry: FieldGeometry, weights: number[]): FieldGeometry[] {
  if (weights.length <= 1) return [geometry];
  const [minX, minY, maxX, maxY] = bbox(feature(geometry as any));
  const midLatitude = (minY + maxY) / 2;
  const width = (maxX - minX) * Math.cos(midLatitude * Math.PI / 180);
  const height = maxY - minY;
  const axis = width >= height ? 'vertical' : 'horizontal';
  const firstCount = Math.ceil(weights.length / 2);
  const firstWeight = weights.slice(0, firstCount).reduce((sum, weight) => sum + weight, 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const halves = splitAtArea(geometry, firstWeight, totalWeight, axis);
  if (!halves) return [geometry];
  return [
    ...splitBalanced(halves[0], weights.slice(0, firstCount)),
    ...splitBalanced(halves[1], weights.slice(firstCount)),
  ];
}

function splitBoundaryInFrame(geometry: FieldGeometry, count: number, direction: SplitDirection, targetAreas?: number[]): FieldGeometry[] {
  if (!Number.isInteger(count) || count < 2 || count > 16) return [];
  const weights = targetAreas?.length === count && targetAreas.every((area) => Number.isFinite(area) && area > 0)
    ? targetAreas
    : Array.from({ length: count }, () => 1);
  if (direction === 'balanced') {
    const camps = splitBalanced(geometry, weights);
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
    const targetWeight = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const targetArea = (totalArea * targetWeight) / totalWeight;
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

export function splitBoundary(
  geometry: FieldGeometry,
  count: number,
  direction: SplitDirection,
  targetAreas?: number[],
  angle = 0,
): FieldGeometry[] {
  const clampedAngle = Number.isFinite(angle) ? Math.max(-45, Math.min(45, angle)) : 0;
  if (clampedAngle === 0) return splitBoundaryInFrame(geometry, count, direction, targetAreas);

  const [minX, minY, maxX, maxY] = bbox(feature(geometry as any));
  const pivot: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
  const rotated = transformRotate(feature(geometry as any), -clampedAngle, { pivot }).geometry as FieldGeometry;
  return splitBoundaryInFrame(rotated, count, direction, targetAreas).map((camp) =>
    transformRotate(feature(camp as any), clampedAngle, { pivot }).geometry as FieldGeometry,
  );
}