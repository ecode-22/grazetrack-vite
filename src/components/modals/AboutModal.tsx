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
      <p>Rotational grazing management with offline-first farm records and optional cloud sync.</p>
      <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        This is a Vite/React rebuild of the original vanilla-JS app, offline-first with optional
        cloud sync.
      </p>
    </Modal>
  );
}
