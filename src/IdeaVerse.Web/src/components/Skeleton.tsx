import { useNarrowScreen } from './useNarrowScreen';

/** The shapes a placeholder can take: lines of text, cards, a page, or one of the ideas' views. */
type Variant = 'lines' | 'cards' | 'page' | 'board' | 'calendar' | 'timeline' | 'matrix';

/** Where each placeholder timeline bar starts and how long it runs, in percent of the scale. */
const bars = [
  [8, 30],
  [20, 45],
  [35, 25],
  [50, 35],
];

/** A shimmering placeholder in the shape of the content that is loading, announced to screen readers as "Loading…". */
export function Skeleton({ lines = 3, variant = 'lines' }: { lines?: number; variant?: Variant }) {
  const narrow = useNarrowScreen();
  // On a phone the calendar, timeline and matrix are lists, so they load as cards.
  const shape = narrow && (variant === 'calendar' || variant === 'timeline' || variant === 'matrix') ? 'cards' : variant;
  const loading = <span className="visually-hidden">Loading…</span>;

  if (shape === 'board') {
    return (
      <div className="skeleton-board">
        {loading}
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton-column" aria-hidden="true">
            <span className="skeleton-line short" />
            {Array.from({ length: i % 2 === 0 ? 2 : 1 }, (_, c) => (
              <div key={c} className="card skeleton-card">
                <span className="skeleton-line wide" />
                <span className="skeleton-line short" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (shape === 'calendar' || shape === 'matrix') {
    return (
      <div className="card skeleton-view">
        {loading}
        {shape === 'calendar' && <span className="skeleton-line title" aria-hidden="true" />}
        <div className={`skeleton-grid ${shape}`} aria-hidden="true">
          {Array.from({ length: shape === 'calendar' ? 35 : 25 }, (_, i) => (
            <span key={i} className="skeleton-cell" />
          ))}
        </div>
      </div>
    );
  }

  if (shape === 'timeline') {
    return (
      <div className="card skeleton-view">
        {loading}
        {bars.map(([left, width], i) => (
          <div key={i} className="skeleton-timeline-row" aria-hidden="true">
            <span className="skeleton-line" />
            <span className="skeleton-track">
              <span className="skeleton-line skeleton-bar" style={{ marginLeft: `${left}%`, width: `${width}%` }} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (shape === 'cards') {
    return (
      <div className="skeleton-cards">
        {loading}
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
    <div className={shape === 'page' ? 'skeleton card' : 'skeleton'}>
      {loading}
      {shape === 'page' && <span className="skeleton-line title" aria-hidden="true" />}
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={i === lines - 1 ? 'skeleton-line short' : 'skeleton-line'} aria-hidden="true" />
      ))}
    </div>
  );
}
