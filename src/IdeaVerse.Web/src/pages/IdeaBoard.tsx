import { GripVertical } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Link } from 'react-router';

import { describeDue } from '../api/dates';
import { useMoveIdea } from '../api/queries';
import { statuses, statusLabels, type Idea, type IdeaStatus } from '../api/types';
import { useToast } from '../components/Feedback';
import { Progress } from '../components/Progress';
import { Tags } from '../components/Tags';
import { useIdeaPanel } from '../panel/useIdeaPanel';

/** The drag payload's type, so the board ignores anything else dropped on it. */
const dragType = 'application/x-ideaverse-idea';

/**
 * The ideas as a board with a column per status. Ideas the user may edit can be dragged to another column, or moved
 * with their "Status" menu from the keyboard; the move shows at once and can be undone.
 */
export function IdeaBoard({ ideas }: { ideas: Idea[] }) {
  const move = useMoveIdea();
  const toast = useToast();
  const [moved, setMoved] = useState<Record<string, IdeaStatus>>({});
  const [over, setOver] = useState<IdeaStatus | null>(null);
  const [shown, setShown] = useState(ideas);
  // Fresh ideas from the API carry the saved statuses, so moves made here no longer need overriding.
  if (shown !== ideas) {
    setShown(ideas);
    setMoved({});
  }
  const statusOf = (idea: Idea) => moved[idea.id] ?? idea.status;

  /** Moves an idea between columns; `from` is passed by Undo, whose closure would otherwise see the board as it was. */
  const moveTo = (idea: Idea, status: IdeaStatus, { from = statusOf(idea), undoable = true } = {}) => {
    if (from === status) {
      return;
    }
    setMoved((all) => ({ ...all, [idea.id]: status }));
    move.mutate(
      { idea, status },
      {
        onSuccess: () => {
          if (undoable) {
            toast({ message: `Moved “${idea.title}” to ${statusLabels[status]}`, undo: () => moveTo(idea, from, { from: status, undoable: false }) });
          }
        },
        onError: (error) => {
          setMoved((all) => ({ ...all, [idea.id]: from }));
          toast({ message: error.message, tone: 'error' });
        },
      },
    );
  };

  const drop = (event: DragEvent, status: IdeaStatus) => {
    event.preventDefault();
    setOver(null);
    const idea = ideas.find((i) => i.id === event.dataTransfer.getData(dragType));
    if (idea) {
      moveTo(idea, status);
    }
  };

  return (
    <div className="board">
      {statuses.map((status) => {
        const column = ideas.filter((i) => statusOf(i) === status);
        return (
          <section
            key={status}
            className={over === status ? 'board-column drop-target' : 'board-column'}
            aria-labelledby={`column-${status}`}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(dragType)) {
                event.preventDefault();
                setOver(status);
              }
            }}
            onDragLeave={() => setOver((current) => (current === status ? null : current))}
            onDrop={(event) => drop(event, status)}
          >
            <h2 id={`column-${status}`} className="board-heading">
              <span className={`badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>
              <span className="muted small">{column.length}</span>
            </h2>
            <ul className="board-cards">
              {column.map((idea) => (
                <BoardCard key={idea.id} idea={idea} status={statusOf(idea)} onMove={(to) => moveTo(idea, to)} />
              ))}
            </ul>
            {column.length === 0 && <p className="muted small board-empty">Drop ideas here</p>}
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({ idea, status, onMove }: { idea: Idea; status: IdeaStatus; onMove: (status: IdeaStatus) => void }) {
  const [dragging, setDragging] = useState(false);
  const { linkProps } = useIdeaPanel();
  return (
    <li
      className={['card', 'board-card', idea.isOverdue ? 'is-overdue' : '', dragging ? 'dragging' : ''].filter(Boolean).join(' ')}
      draggable={idea.canEdit}
      onDragStart={(event) => {
        event.dataTransfer.setData(dragType, idea.id);
        event.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      <div className="row spread">
        <Link {...linkProps(idea.id)} className="board-title">
          {idea.title}
        </Link>
        {idea.canEdit && <GripVertical aria-hidden="true" size={16} className="grip" />}
      </div>
      <span className={idea.isOverdue ? 'overdue-text small' : 'muted small'}>Due {describeDue(idea.targetDate)}</span>
      <Progress done={idea.completedComponentCount} total={idea.componentCount} />
      <Tags tags={idea.tags} />
      {idea.canEdit && (
        <label className="board-move small">
          <span className="visually-hidden">Status of {idea.title}</span>
          <select value={status} onChange={(e) => onMove(e.target.value as IdeaStatus)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
}
