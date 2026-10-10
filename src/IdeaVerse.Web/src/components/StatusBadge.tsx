import { statusLabels, type Idea } from '../api/types';

export function StatusBadge({ idea }: { idea: Pick<Idea, 'status' | 'isOverdue'> }) {
  return (
    <span className="badges">
      <span className={`badge status-${idea.status.toLowerCase()}`}>{statusLabels[idea.status]}</span>
      {idea.isOverdue && <span className="badge overdue">Overdue</span>}
    </span>
  );
}
