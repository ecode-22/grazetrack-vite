import { useEffect, useState } from 'react';
import { onDataChanged } from './localStore';

// Any component that reads loadFields()/loadEvents()/loadGroups() directly
// should call this once so it re-renders whenever a write happens
// anywhere in the app (matches the original's pattern of re-rendering
// the sidebar/map/dashboard after every save()).
export function useGtRefresh() {
  const [, setTick] = useState(0);
  useEffect(() => onDataChanged(() => setTick((t) => t + 1)), []);
}
