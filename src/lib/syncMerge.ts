type SyncRecord = { id: string; updatedAt?: string; deletedAt?: string };

export function mergeSyncRecords<T extends SyncRecord>(local: T[], remote: T[]): T[] {
  const merged = new Map<string, T>();
  for (const record of [...remote, ...local]) {
    const current = merged.get(record.id);
    const recordVersion = Math.max(Date.parse(record.updatedAt || '1970-01-01'), Date.parse(record.deletedAt || '1970-01-01'));
    const currentVersion = current
      ? Math.max(Date.parse(current.updatedAt || '1970-01-01'), Date.parse(current.deletedAt || '1970-01-01'))
      : -1;
    if (!current || recordVersion >= currentVersion) merged.set(record.id, record);
  }
  return [...merged.values()];
}