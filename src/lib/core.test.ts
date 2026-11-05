import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calcAreaHa } from './geo';
import { splitBoundary } from './splitGeometry';
import { getStatus } from './status';
import { daysBetween, daysSince, todayStr, addDays } from './utils';
import { mergeSyncRecords } from './syncMerge';
import { loadEvents } from './localStore';
import type { Field, GrazingEvent } from './types';

vi.mock('./localStore', () => ({ loadEvents: vi.fn() }));

const square = {
  type: 'Polygon' as const,
  coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]],
};

const field: Field = {
  id: 'field-1',
  name: 'North',
  type: 'pasture',
  restTarget: 30,
  maxAUperHa: null,
  geometry: square,
  areaHa: 1,
  color: '#2d6a4f',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('date and status rules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T22:30:00.000Z'));
    vi.mocked(loadEvents).mockReset();
  });

  it('uses the South African calendar date and inclusive grazing days', () => {
    expect(todayStr()).toBe('2026-11-02');
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(1);
    expect(daysSince('2026-11-03')).toBe(-1);
  });

  it('labels future-dated grazing as planned', () => {
    const startDate = addDays(todayStr(), 1);
    vi.mocked(loadEvents).mockReturnValue([{
      id: 'event-1', fieldId: field.id, startDate, endDate: addDays(startDate, 6),
      animalType: 'cattle', animalCount: 10, herd: 'A', notes: '', loggedAt: startDate,
    } satisfies GrazingEvent]);
    expect(getStatus(field)).toEqual({ label: 'Planned', cls: 'resting' });
  });

  it('labels recovery as resting instead of a danger state', () => {
    vi.mocked(loadEvents).mockReturnValue([{
      id: 'event-1', fieldId: field.id, startDate: '2026-10-28', endDate: '2026-11-01',
      animalType: 'cattle', animalCount: 10, herd: 'A', notes: '', loggedAt: '2026-10-28',
    } satisfies GrazingEvent]);
    expect(getStatus(field)).toEqual({ label: 'Resting · 29 days to go', cls: 'resting' });
  });
});

describe('splitBoundary', () => {
  it('splits a valid boundary into the requested number of usable paddocks', () => {
    const parts = splitBoundary(square, 2, 'vertical');
    expect(parts).toHaveLength(2);
    expect(parts.every((part) => calcAreaHa(part) >= 0.01)).toBe(true);
    expect(parts.reduce((sum, part) => sum + calcAreaHa(part), 0)).toBeCloseTo(calcAreaHa(square), 2);
  });
});

describe('mergeSyncRecords', () => {
  it('keeps a newer tombstone over a stale remote record', () => {
    const local = [{ id: 'field-1', updatedAt: '2026-11-02T10:00:00Z', deletedAt: '2026-11-02T10:00:00Z' }];
    const remote = [{ id: 'field-1', updatedAt: '2026-11-01T10:00:00Z' }];
    expect(mergeSyncRecords(local, remote)).toEqual(local);
  });

  it('keeps the newer record update over an older tombstone', () => {
    const local = [{ id: 'event-1', updatedAt: '2026-11-02T10:00:00Z' }];
    const remote = [{ id: 'event-1', updatedAt: '2026-11-01T10:00:00Z', deletedAt: '2026-11-01T10:00:00Z' }];
    expect(mergeSyncRecords(local, remote)).toEqual(local);
  });
});