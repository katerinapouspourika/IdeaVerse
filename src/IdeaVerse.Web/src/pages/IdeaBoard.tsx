import { GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Link } from 'react-router';

import { describeDue } from '../api/dates';
import { useMoveIdea } from '../api/queries';
import { canChange, statuses, statusLabels, type Idea, type IdeaStatus } from '../api/types';
import { useToast } from '../components/Feedback';
import { Menu } from '../components/Menu';
import { Progress } from '../components/Progress';
import { Tags } from '../components/Tags';
import { useIdeaPanel } from '../panel/useIdeaPanel';
import { usePointerDrag } from './usePointerDrag';

/**
 * The ideas as a board with a column per status. Ideas the user may edit can be dragged to another column with a mouse,
 * pen, or finger, or moved with the menu on their grip; the move shows at once and can be undone.
 */
export function IdeaBoard({ ideas }: { ideas: Idea[] }) {
  const move = useMoveIdea();
  const toast = useToast();
  const [moved, setMoved] = useState<Record<string, IdeaStatus>>({});
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
            toast({
              message: `Moved “${idea.title}” to ${statusLabels[status]}`,
              // Undo's button goes with its toast, so focus moves back with the card to its grip.
              undo: () => {
                refocus.current = idea.id;
                moveTo(idea, from, { from: status, undoable: false });
              },
            });
          }
        },
        onError: (error) => {
          setMoved((all) => ({ ...all, [idea.id]: from }));
          toast({ message: error.message, tone: 'error' });
        },
      },
    );
  };

  const { container, drag, onPointerDown, onContextMenu } = usePointerDrag<IdeaStatus>((id, status) => {
    const idea = ideas.find((i) => i.id === id);
    if (idea) {
      moveTo(idea, status);
    }
  });
  const dragged = drag && ideas.find((i) => i.id === drag.id);

  // A card moved with its menu, or back with Undo, lands in another column as a new element, so focus follows it there
  // to its grip.
  const refocus = useRef<string | null>(null);
  useEffect(() => {
    if (refocus.current) {
      container.current?.querySelector<HTMLElement>(`[data-idea="${refocus.current}"] .board-grip`)?.focus();
      refocus.current = null;
    }
  });

  return (
    <div ref={container} className={drag ? 'board is-dragging' : 'board'}>
      {statuses.map((status) => {
        const column = ideas.filter((i) => statusOf(i) === status);
        const target = drag?.over === status && dragged && statusOf(dragged) !== status;
        return (
          <section
            key={status}
            className={`board-column status-${status.toLowerCase()}${target ? ' drop-target' : ''}`}
            aria-labelledby={`column-${status}`}
            data-drop={status}
          >
            <h2 id={`column-${status}`} className="board-heading">
              <span className={`badge status-badge status-${status.toLowerCase()}`}>{statusLabels[status]}</span>
              <span className="muted small">{column.length}</span>
            </h2>
            <ul className="board-cards">
              {column.map((idea) => (
                <BoardCard
                  key={idea.id}
                  idea={idea}
                  status={statusOf(idea)}
                  dragging={drag?.id === idea.id}
                  onMove={(to) => {
                    if (to !== statusOf(idea)) {
                      refocus.current = idea.id;
                      moveTo(idea, to);
                    }
                  }}
                  onPointerDown={(event) => onPointerDown(event, idea.id)}
                  onContextMenu={onContextMenu}
                />
              ))}
              {target && (
                <li className="board-drop-slot small" aria-hidden="true">
                  Move to {statusLabels[status]}
                </li>
              )}
            </ul>
            {column.length === 0 && !target && <p className="muted small board-empty">Drop ideas here</p>}
          </section>
        );
      })}
      {drag && dragged && (
        <div className="card board-card board-drag-preview" aria-hidden="true" style={{ left: drag.left, top: drag.top, width: drag.width }}>
          <span className="board-title">{dragged.title}</span>
        </div>
      )}
    </div>
  );
}

/**
 * A card that opens the idea from anywhere on it, as its title link does. Its grip, above the link, opens a menu to move
 * the idea to another column, the way to move it from the keyboard or a screen reader; the card itself can be dragged.
 */
function BoardCard({
  idea,
  status,
  dragging,
  onMove,
  onPointerDown,
  onContextMenu,
}: {
  idea: Idea;
  status: IdeaStatus;
  dragging: boolean;
  onMove: (status: IdeaStatus) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
}) {
  const { linkProps } = useIdeaPanel();
  const movable = canChange(idea);
  return (
    <li
      data-idea={idea.id}
      className={['card', 'board-card', idea.isOverdue ? 'is-overdue' : '', movable ? 'movable' : '', dragging ? 'dragging' : ''].filter(Boolean).join(' ')}
      onPointerDown={movable ? onPointerDown : undefined}
      onContextMenu={movable ? onContextMenu : undefined}
    >
      <div className="row spread">
        {/* Stretched over the whole card, so a click anywhere opens the idea. */}
        <Link {...linkProps(idea.id)} className="board-title stretched-link" draggable={false}>
          {idea.title}
        </Link>
        {movable && (
          <div className="board-move">
            <Menu
              label={`Move ${idea.title}`}
              listLabel="Move to"
              trigger={<GripVertical aria-hidden="true" size={16} />}
              triggerClassName="button ghost small icon-button board-grip"
              floating
              items={statuses.map((s) => ({ label: statusLabels[s], checked: s === status, onSelect: () => onMove(s) }))}
            />
          </div>
        )}
      </div>
      <span className={idea.isOverdue ? 'overdue-text small' : 'muted small'}>Target date {describeDue(idea.targetDate)}</span>
      <Progress done={idea.completedComponentCount} total={idea.componentCount} />
      <Tags tags={idea.tags} />
    </li>
  );
}
