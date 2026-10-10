export function Progress({ done, total }: { done: number; total: number }) {
  if (total === 0) {
    return <span className="muted small">No components yet</span>;
  }

  return (
    <span className="progress" title={`${done} of ${total} components ready`}>
      <span className="progress-track" aria-hidden="true">
        <span className="progress-fill" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="small">
        {done}/{total} ready
      </span>
    </span>
  );
}
