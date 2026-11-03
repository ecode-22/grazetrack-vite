import { useState } from 'react';
import type { FormEvent } from 'react';

export default function FeedbackForm() {
  const [type, setType] = useState<'Review' | 'Bug report'>('Review');
  const [rating, setRating] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const subject = `GrazeTrack ${type}`;
    const body = [
      `Type: ${type}`,
      type === 'Review' && rating ? `Rating: ${rating}/5` : '',
      '',
      message.trim(),
    ].filter(Boolean).join('\n');

    window.location.href =
      `mailto:grazetrack@gmail.com?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  return (
    <details className="feedback-panel">
      <summary>Send a review or bug report</summary>
      <form className="feedback-form" onSubmit={handleSubmit}>
        <label>
          Feedback type
          <select
            value={type}
            onChange={(event) => setType(event.target.value as 'Review' | 'Bug report')}
          >
            <option>Review</option>
            <option>Bug report</option>
          </select>
        </label>

        {type === 'Review' && (
          <label>
            Rating (optional)
            <select value={rating} onChange={(event) => setRating(event.target.value)}>
              <option value="">Choose a rating</option>
              <option value="1">1/5</option>
              <option value="2">2/5</option>
              <option value="3">3/5</option>
              <option value="4">4/5</option>
              <option value="5">5/5</option>
            </select>
          </label>
        )}

        <label>
          Message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            rows={4}
          />
        </label>
        <button className="feedback-submit" type="submit">Continue to email</button>
        <p className="feedback-note">
          Your email app will open with this message addressed to{' '}
          <a href="mailto:grazetrack@gmail.com">grazetrack@gmail.com</a>.
        </p>
      </form>
    </details>
  );
}