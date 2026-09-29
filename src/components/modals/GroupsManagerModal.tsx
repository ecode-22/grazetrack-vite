import { useState } from 'react';
import Modal from './Modal';
import GroupModal from './GroupModal';
import { loadGroups, saveGroups } from '@/lib/localStore';
import { useGtRefresh } from '@/lib/useGtRefresh';
import { groupEmoji } from '@/lib/utils';

export default function GroupsManagerModal({ onClose }: { onClose: () => void }) {
  useGtRefresh();
  const [editId, setEditId] = useState<string | null | 'new'>(null);

  const groups = loadGroups();

  function deleteGroup(id: string) {
    const g = groups.find((x) => x.id === id);
    if (!g || !confirm(`Delete group "${g.name}"?`)) return;
    saveGroups(groups.filter((x) => x.id !== id));
  }

  return (
    <>
      <Modal
        title="🐄 Animal Groups"
        onClose={onClose}
        footer={
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        }
      >
        <button className="grp-add-btn" onClick={() => setEditId('new')}>
          + Add group
        </button>
        {!groups.length ? (
          <div className="grp-empty-card">
            <p>No animal groups yet.</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Groups let you log grazing with one tap — the animal type, count and herd fill in
              automatically.
            </p>
            <button className="btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => setEditId('new')}>
              + Add your first group
            </button>
          </div>
        ) : (
          <div className="grp-list">
            {groups.map((g) => (
              <div className="grp-row" key={g.id}>
                <div className="grp-row-icon">{groupEmoji(g.type)}</div>
                <div className="grp-row-info">
                  <div className="grp-row-name">{g.name}</div>
                  <div className="grp-row-sub">
                    {g.count} {g.type}
                    {g.herd ? ` · ${g.herd}` : ''}
                  </div>
                </div>
                <div className="grp-row-actions">
                  <button className="grp-btn" title="Edit" onClick={() => setEditId(g.id)}>
                    ✎
                  </button>
                  <button className="grp-btn red" title="Delete" onClick={() => deleteGroup(g.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {editId && (
        <GroupModal
          editId={editId === 'new' ? null : editId}
          onClose={() => setEditId(null)}
          onSaved={() => setEditId(null)}
        />
      )}
    </>
  );
}
