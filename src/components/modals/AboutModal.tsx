import Modal from './Modal';
import { Link } from 'react-router-dom';
import FeedbackForm from '@/components/FeedbackForm';

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
      <section className="about-legal-section" aria-labelledby="about-legal-title">
        <h2 id="about-legal-title">Legal and privacy</h2>
        <p>Review how the demo handles information and the terms for using it.</p>
        <nav className="about-legal-links" aria-label="Legal information">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Use</Link>
        </nav>
      </section>
      <section className="about-feedback-section" aria-labelledby="about-feedback-title">
        <h2 id="about-feedback-title">Help improve GrazeTrack</h2>
        <p>Share a review or tell us what went wrong.</p>
        <FeedbackForm />
      </section>
    </Modal>
  );
}
