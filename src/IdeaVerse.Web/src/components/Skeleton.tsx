/** A shimmering placeholder in the shape of the content that is loading, announced to screen readers as "Loading…". */
export function Skeleton({ lines = 3, variant = 'lines' }: { lines?: number; variant?: 'lines' | 'cards' | 'page' }) {
  if (variant === 'cards') {
    return (
      <div className="skeleton-cards">
        <span className="visually-hidden">Loading…</span>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="card skeleton-card" aria-hidden="true">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={variant === 'page' ? 'skeleton card' : 'skeleton'}>
      <span className="visually-hidden">Loading…</span>
      {variant === 'page' && <span className="skeleton-line title" aria-hidden="true" />}
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={i === lines - 1 ? 'skeleton-line short' : 'skeleton-line'} aria-hidden="true" />
      ))}
    </div>
  );
}
