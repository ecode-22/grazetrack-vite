import Modal from './Modal';

export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="🌾 About GrazingTrack"
      onClose={onClose}
      footer={
        <button className="btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <p>Free open source rotational grazing management. All data stays on your device.</p>
      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        This is a Vite/React rebuild of the original vanilla-JS app, offline-first with optional
        cloud sync.
      </p>
    </Modal>
  );
}
