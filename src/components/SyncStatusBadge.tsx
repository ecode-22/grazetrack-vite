
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
    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/80">
      {LABEL[status]}
    </span>
  );
}
