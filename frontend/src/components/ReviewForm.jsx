import { useState } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { useSubmitReview } from '../hooks/orders.js';

export default function ReviewForm({ productId, onDone }) {
  const toast = useToast();
  const submit = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const send = (e) => {
    e.preventDefault();
    if (!rating) return setError('Please choose a rating from 1 to 5.');
    setError('');
    submit.mutate(
      { productId, rating, comment: comment.trim() },
      {
        onSuccess: () => {
          toast('Thanks for your review');
          onDone('done');
        },
        onError: (err) => {
          if (err.status === 409) {
            toast('You already reviewed this product');
            onDone('done');
          } else {
            setError(err.message);
          }
        },
      }
    );
  };

  return (
    <form className="review-form" onSubmit={send}>
      <div className="rate" role="radiogroup" aria-label="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={n <= rating ? 'on' : ''}
            onClick={() => setRating(n)}
          >
            <svg viewBox="0 0 24 24" width="26" height="26">
              <path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        className="input area"
        rows={3}
        maxLength={1000}
        placeholder="Tell others what you think (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        aria-label="Your review"
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="review-actions">
        <button className="btn btn-primary slim" disabled={submit.isPending}>
          {submit.isPending ? 'Sending...' : 'Post review'}
        </button>
        <button type="button" className="btn slim" onClick={() => onDone('idle')}>
          Cancel
        </button>
      </div>
    </form>
  );
}