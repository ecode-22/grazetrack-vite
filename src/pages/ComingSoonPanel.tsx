export default function ComingSoonPanel({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="sv">
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚧</div>
        <div className="card-title" style={{ marginBottom: 4 }}>
          {title} — not yet ported
        </div>
        <p style={{ fontSize: 13, maxWidth: 420, margin: '0 auto' }}>{blurb}</p>
      </div>
    </div>
  );
}
