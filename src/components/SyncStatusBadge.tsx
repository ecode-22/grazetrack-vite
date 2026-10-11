
import { useEffect, useState } from 'react';
import { onSyncStatusChange } from '@/lib/sync';
import type { SyncStatus } from '@/lib/sync';

const LABEL: Record<SyncStatus, string> = {
  offline: '📴 Offline — saving locally',
  synced: '✅ Synced',
  syncing: '🔄 Syncing…',
  pending: '⏳ Changes pending',
  error: '⚠️ Sync error',
  'no-account': '👤 Not signed in — local only',
};

export default function SyncStatusBadge() {
  const [status, setStatus] = useState<SyncStatus>('offline');

  useEffect(() => {
    const unsubscribe = onSyncStatusChange(setStatus);
    return () => unsubscribe();
  }, []);

  return (
    <span className={`sync-status sync-status-${status}`} role="status">
      {LABEL[status]}
    </span>
  );
}
