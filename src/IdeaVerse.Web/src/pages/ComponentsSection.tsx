import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleAlert, Ellipsis, GripVertical, Trash2, UserRound, UserRoundCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';

import { SuggestComponents } from '../ai/SuggestComponents';
import { daysUntil, describeDue, formatDate } from '../api/dates';
import {
  keys,
  workspaceMembersQuery,
  useAddComponent,
  useComponents,
  useDeleteComponent,
  useReorderComponents,
  useUpdateComponent,
  useWorkspaceMembers,
} from '../api/queries';
import { personLabel, type Component } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { Menu } from '../components/Menu';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';
import { useLinkedItem } from './useLinkedItem';

const componentDragType = 'application/x-ideaverse-component';

/** The idea's checklist; without `canEdit` it is read-only. */
export function ComponentsSection({ ideaId, workspaceId, canEdit }: { ideaId: string; workspaceId: string; canEdit: boolean }) {
  const components = useComponents(ideaId);
  const update = useUpdateComponent(ideaId);
  const remove = useDeleteComponent(ideaId);
  const client = useQueryClient();
  const add = useAddComponent(ideaId);
  const reorder = useReorderComponents(ideaId);
  const toast = useToast();
  const { account } = useAuth();
  const [announcement, setAnnouncement] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const refocus = useRef<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const moveHintId = useId();
  const canReorder = canEdit && (components.data?.length ?? 0) > 1;
  const linked = useLinkedItem('component', components.data?.map((c) => c.id));

  /** Moves a component to another place in the list, announcing where it went; returns whether it moved. */
  const move = (component: Component, to: number) => {
    const current = components.data ?? [];
    const from = current.findIndex((c) => c.id === component.id);
    if (from < 0 || to < 0 || to >= current.length || to === from) {
      return false;
    }
    const ids = current.map((c) => c.id);
    ids.splice(from, 1);
    ids.splice(to, 0, component.id);
    reorder.mutate(ids, { onError: () => toast({ message: 'Couldn’t save the new order. Try again.', tone: 'error' }) });
    setAnnouncement(`Moved “${component.title}” to position ${to + 1} of ${current.length}.`);
    return true;
  };

  // Moving a row re-inserts it, which drops focus; puts focus back on the handle that was used.
  useEffect(() => {
    if (refocus.current) {
      list.current?.querySelector<HTMLElement>(`[data-move="${refocus.current}"]`)?.focus();
      refocus.current = null;
    }
  }, [components.data]);

  /** Removes a component straight away, offering Undo, which adds it back in its place with its assignment, due date, and done state. */
  const removeComponent = (component: Component) => {
    const place = (components.data ?? []).findIndex((c) => c.id === component.id);
    // Undo adds the component again, at the end; puts it back in its old place among the components there are now.
    const putBack = (created: Component) => {
      const current = client.getQueryData<Component[]>(keys.components(ideaId)) ?? components.data ?? [];
      const ids = current.map((c) => c.id).filter((id) => id !== component.id && id !== created.id);
      if (place >= 0 && place < ids.length) {
        ids.splice(place, 0, created.id);
        reorder.mutate(ids);
      }
    };
    return remove.mutate(component.id, {
      onSuccess: () =>
        toast({
          message: `Removed “${component.title}”`,
          undo: () =>
            add.mutate(
              { title: component.title, notes: component.notes },
              {
                onSuccess: (created) => {
                  putBack(created);
                  if (component.isDone || component.assigneeId || component.dueDate) {
                    update.mutate({
                      id: created.id,
                      title: component.title,
                      notes: component.notes,
                      isDone: component.isDone,
                      assigneeId: component.assigneeId,
                      dueDate: component.dueDate,
                    });
                  }
                },
              },
            ),
        }),
    });
  };

  /** Assigns a component to the signed-in user, finding them among the workspace's people, and offers Undo. */
  const assignToMe = async (component: Component) => {
    const people = await client.fetchQuery(workspaceMembersQuery(workspaceId)).catch(() => []);
    const me = people.find((person) => person.email.toLowerCase() === account?.email.toLowerCase());
    if (!me) {
      toast({ message: 'Couldn’t assign it to you. Try again.', tone: 'error' });
      return;
    }
    const assign = (assigneeId: string | null, then?: () => void) =>
      update.mutate(
        { id: component.id, title: component.title, notes: component.notes, isDone: component.isDone, assigneeId, dueDate: component.dueDate },
        { onSuccess: then },
      );
    assign(me.userId, () => toast({ message: `Assigned “${component.title}” to you`, undo: () => assign(component.assigneeId) }));
  };

  return (
    <section className="card stack" aria-labelledby="components-heading">
      <h2 id="components-heading">What it needs</h2>
      <p className="muted small">Components are the things that must be in place before this idea can happen.</p>
      {components.data && components.data.length > 0 && (
        <ChecklistProgress done={components.data.filter((c) => c.isDone).length} total={components.data.length} />
      )}
      {components.isLoading && <Skeleton />}
      {components.data?.length === 0 && <p className="muted">Nothing listed yet.</p>}
      {components.data && components.data.length > 0 && (
        <ul className="checklist" ref={list}>
          {components.data.map((component, index) => (
            <ComponentItem
              key={component.id}
              ideaId={ideaId}
              workspaceId={workspaceId}
              component={component}
              canEdit={canEdit}
              linked={linked === component.id}
              isMine={component.assigneeEmail !== null && component.assigneeEmail.toLowerCase() === account?.email.toLowerCase()}
              reorder={
                canReorder
                  ? {
                      hintId: moveHintId,
                      dragging: dragged === component.id,
                      onKeyMove: (step) => {
                        if (move(component, index + step)) {
                          refocus.current = component.id;
                        }
                      },
                      onDragStart: () => setDragged(component.id),
                      onDragEnd: () => setDragged(null),
                      onDrop: () => {
                        const source = components.data?.find((c) => c.id === dragged);
                        if (source) {
                          move(source, index);
                        }
                        setDragged(null);
                      },
                      acceptsDrop: dragged !== null && dragged !== component.id,
                    }
                  : undefined
              }
              onToggle={(isDone, onSettled) =>
                update.mutate(
                  { id: component.id, title: component.title, notes: component.notes, isDone, assigneeId: component.assigneeId, dueDate: component.dueDate },
                  { onSettled },
                )
              }
              onAssignToMe={() => void assignToMe(component)}
              onRemove={() => removeComponent(component)}
            />
          ))}
        </ul>
      )}
      {canReorder && (
        <p id={moveHintId} className="visually-hidden">
          Use the arrow keys to move it up or down the list.
        </p>
      )}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      <LoadError queries={components} />
      <ErrorMessage error={update.error ?? remove.error} />
      {canEdit && <AddComponentForm ideaId={ideaId} />}
      {canEdit && <SuggestComponents ideaId={ideaId} workspaceId={workspaceId} />}
    </section>
  );
}

/** How far along the checklist is, in words and as a labelled bar. */
function ChecklistProgress({ done, total }: { done: number; total: number }) {
  const labelId = useId();
  const percent = Math.round((done / total) * 100);
  const label = done === total ? `All ${total} done` : `${done} of ${total} done`;

  return (
    <div className="checklist-progress">
      <div className="row spread small">
        <span id={labelId}>
          <strong>{label}</strong>
        </span>
        <span className="muted">{percent}%</span>
      </div>
      <div
        className="progress-track wide"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} components done, ${percent}%`}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** How a row takes part in reordering: by dragging it, or by the arrow keys on its handle. */
interface Reorder {
  hintId: string;
  dragging: boolean;
  /** Whether another row is being dragged over this one. */
  acceptsDrop: boolean;
  onKeyMove: (step: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

interface ComponentItemProps {
  ideaId: string;
  workspaceId: string;
  component: Component;
  canEdit: boolean;
  /** Whether a link, such as a notification's, just brought the user to this component. */
  linked: boolean;
  /** Whether the component is already assigned to the signed-in user. */
  isMine: boolean;
  /** Present when the list can be reordered. */
  reorder?: Reorder;
  onToggle: (isDone: boolean, onSettled: () => void) => void;
  onAssignToMe: () => void;
  onRemove: () => void;
}

/** The field the details editor starts on: the one whose chip was clicked. */
type DetailsField = 'assignee' | 'due';

/**
 * How soon a component not yet done is due, in the user's own calendar: `overdue` once the date has passed, `soon` today and
 * for the next two days.
 */
function dueUrgency(dueDate: string, isDone: boolean): 'overdue' | 'soon' | null {
  if (isDone) return null;
  const days = daysUntil(dueDate);
  return days < 0 ? 'overdue' : days <= 2 ? 'soon' : null;
}

/** The due date chip's text, which says in words what its colour shows. */
function dueText(dueDate: string, urgency: 'overdue' | 'soon' | null): string {
  if (urgency === 'overdue') return `Overdue · ${formatDate(dueDate)}`;
  if (urgency === 'soon') return `Due ${describeDue(dueDate)} · ${formatDate(dueDate)}`;
  return `Due ${formatDate(dueDate)}`;
}

/**
 * A checklist row: its checkbox responds the moment it is clicked, before the API confirms the change. For the team, the title
 * renames the component in place, its assignee and due date chips open the details editor, and the "⋯" menu holds the rest.
 */
function ComponentItem({ ideaId, workspaceId, component, canEdit, isMine, linked, reorder, onToggle, onAssignToMe, onRemove }: ComponentItemProps) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [details, setDetails] = useState<DetailsField | null>(null);
  const [dropTarget, setDropTarget] = useState(false);
  // Only the handle starts a drag, so dragging across the title or a form field selects text as usual.
  const [dragArmed, setDragArmed] = useState(false);
  // A cancelled drag never leaves the row it was over, so the highlight shows only while a drag is under way.
  const highlighted = dropTarget && (reorder?.acceptsDrop ?? false);
  const titleButton = useRef<HTMLButtonElement>(null);
  const wasRenaming = useRef(false);
  // The chip or menu button that opened the details editor, which gets focus back when it closes.
  const detailsOpener = useRef<HTMLElement | null>(null);

  // Returns focus to the title once the rename is saved or cancelled.
  useEffect(() => {
    if (wasRenaming.current && !renaming) {
      titleButton.current?.focus();
    }
    wasRenaming.current = renaming;
  }, [renaming]);

  const checked = pending ?? component.isDone;
  const assignee = component.assigneeEmail ? personLabel(component.assigneeName, component.assigneeEmail) : null;
  const urgency = component.dueDate ? dueUrgency(component.dueDate, checked) : null;

  const toggle = () => {
    setPending(!checked);
    onToggle(!checked, () => setPending(null));
  };

  const openDetails = (field: DetailsField) => {
    detailsOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDetails(field);
  };

  const closeDetails = () => {
    setDetails(null);
    detailsOpener.current?.focus();
  };

  const onHandleKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      reorder?.onKeyMove(event.key === 'ArrowUp' ? -1 : 1);
    }
  };

  return (
    <li
      id={`component-${component.id}`}
      tabIndex={-1}
      className={
        [checked ? 'done' : '', reorder?.dragging ? 'dragging' : '', highlighted ? 'drop-target' : '', linked ? 'linked' : ''].filter(Boolean).join(' ') ||
        undefined
      }
      draggable={reorder !== undefined && dragArmed}
      onDragStart={(event) => {
        event.dataTransfer.setData(componentDragType, component.id);
        event.dataTransfer.effectAllowed = 'move';
        reorder?.onDragStart();
      }}
      onDragEnd={() => {
        setDragArmed(false);
        reorder?.onDragEnd();
      }}
      onDragOver={(event) => {
        if (reorder?.acceptsDrop && event.dataTransfer.types.includes(componentDragType)) {
          event.preventDefault();
          setDropTarget(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropTarget(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropTarget(false);
        reorder?.onDrop();
      }}
    >
      <div className={reorder ? 'component-row reorderable' : 'component-row'}>
        {reorder && (
          <button
            type="button"
            className="button ghost small icon-button move-handle"
            data-move={component.id}
            aria-label={`Move ${component.title}`}
            aria-describedby={reorder.hintId}
            title="Drag, or use the arrow keys, to reorder"
            onKeyDown={onHandleKey}
            onPointerDown={() => setDragArmed(true)}
            onPointerUp={() => setDragArmed(false)}
          >
            <GripVertical aria-hidden="true" size={16} />
          </button>
        )}
        <label className="component-check">
          <input type="checkbox" aria-label={component.title} checked={checked} onChange={toggle} disabled={!canEdit} />
        </label>
        <div className="component-body">
          {renaming ? (
            <RenameForm ideaId={ideaId} component={component} onDone={() => setRenaming(false)} />
          ) : canEdit ? (
            <button ref={titleButton} type="button" className="check-title title-button" aria-label={`Rename ${component.title}`} title="Rename" onClick={() => setRenaming(true)}>
              {component.title}
            </button>
          ) : (
            <span className="check-title">{component.title}</span>
          )}
          {component.notes && <span className="muted small block">{component.notes}</span>}
          {(assignee || component.dueDate) && (
            <span className="chips">
              {assignee && (
                <Chip icon={<UserRound aria-hidden="true" size={14} />} onEdit={canEdit ? () => openDetails('assignee') : undefined} editLabel={`Change who does ${component.title}: ${assignee}`}>
                  <span className="visually-hidden">Assigned to </span>
                  {assignee}
                </Chip>
              )}
              {component.dueDate && (
                <Chip
                  className={urgency ?? undefined}
                  icon={urgency === 'overdue' ? <CircleAlert aria-hidden="true" size={14} /> : <CalendarDays aria-hidden="true" size={14} />}
                  onEdit={canEdit ? () => openDetails('due') : undefined}
                  editLabel={`Change the due date of ${component.title}: ${dueText(component.dueDate, urgency)}`}
                >
                  {dueText(component.dueDate, urgency)}
                </Chip>
              )}
            </span>
          )}
        </div>
        {canEdit && (
          <Menu
            label={`More actions for ${component.title}`}
            trigger={<Ellipsis aria-hidden="true" size={18} />}
            items={[
              { label: 'Assignee and due date', icon: <CalendarDays aria-hidden="true" size={16} />, onSelect: () => openDetails('assignee') },
              ...(isMine ? [] : [{ label: 'Assign to me', icon: <UserRoundCheck aria-hidden="true" size={16} />, onSelect: onAssignToMe }]),
              { label: 'Remove', icon: <Trash2 aria-hidden="true" size={16} />, onSelect: onRemove, danger: true },
            ]}
          />
        )}
      </div>
      {details && <DetailsForm ideaId={ideaId} workspaceId={workspaceId} component={component} field={details} onDone={closeDetails} />}
    </li>
  );
}

/** An assignee or due date tag on a row; a button that opens the details editor for those who can change it. */
function Chip({ className, icon, onEdit, editLabel, children }: { className?: string; icon: ReactNode; onEdit?: () => void; editLabel: string; children: ReactNode }) {
  const classes = className ? `chip ${className}` : 'chip';
  return onEdit ? (
    <button type="button" className={classes} aria-label={editLabel} onClick={onEdit}>
      {icon}
      {children}
    </button>
  ) : (
    <span className={classes}>
      {icon}
      {children}
    </span>
  );
}

/** Renames a component in place: Enter saves, Escape cancels, and leaving the field saves a changed title. */
function RenameForm({ ideaId, component, onDone }: { ideaId: string; component: Component; onDone: () => void }) {
  const update = useUpdateComponent(ideaId);
  const [title, setTitle] = useState(component.title);
  // Set once the form is closing, so the field losing focus as it goes doesn't save again.
  const closed = useRef(false);

  const close = () => {
    closed.current = true;
    onDone();
  };

  const save = () => {
    if (closed.current || update.isPending) {
      return;
    }
    if (title.trim() === '' || title === component.title) {
      close();
      return;
    }
    update.mutate(
      { id: component.id, title, notes: component.notes, isDone: component.isDone, assigneeId: component.assigneeId, dueDate: component.dueDate },
      { onSuccess: close },
    );
  };

  return (
    <form
      className="rename-form"
      aria-label={`Rename ${component.title}`}
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      <Field label={<span className="visually-hidden">Title</span>} hint="Enter saves, Escape cancels." error={fieldError(update.error, 'title')}>
        {(props) => (
          <input {...props} required maxLength={200} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} />
        )}
      </Field>
      <ErrorMessage error={update.error} />
    </form>
  );
}

/** Chooses who is responsible for a component and when it is due, and changes its notes; Escape cancels. */
function DetailsForm({ ideaId, workspaceId, component, field, onDone }: { ideaId: string; workspaceId: string; component: Component; field: DetailsField; onDone: () => void }) {
  const people = useWorkspaceMembers(workspaceId);
  const update = useUpdateComponent(ideaId);
  const { account } = useAuth();
  const [assigneeId, setAssigneeId] = useState(component.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(component.dueDate ?? '');
  const [notes, setNotes] = useState(component.notes ?? '');
  const me = people.data?.find((person) => person.email.toLowerCase() === account?.email.toLowerCase());

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        id: component.id,
        title: component.title,
        notes: notes || null,
        isDone: component.isDone,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form
      className="stack tight assign-form"
      onSubmit={submit}
      aria-label={`Details of ${component.title}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <div className="row wrap end">
        <Field label="Assigned to" error={fieldError(update.error, 'assigneeId')} className="grow">
          {(props) => (
            <select {...props} autoFocus={field === 'assignee'} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Nobody</option>
              {(people.data ?? []).map((person) => (
                <option key={person.userId} value={person.userId}>
                  {personLabel(person.name, person.email)}
                </option>
              ))}
            </select>
          )}
        </Field>
        {me && assigneeId !== me.userId && (
          <button type="button" className="button ghost small" onClick={() => setAssigneeId(me.userId)}>
            Assign to me
          </button>
        )}
        <Field label="Due" error={fieldError(update.error, 'dueDate')}>
          {(props) => <input {...props} type="date" autoFocus={field === 'due'} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
        </Field>
      </div>
      <Field label=<>Notes <span className="muted">(optional)</span></>>
        {(props) => <input {...props} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <div className="row">
        <button type="submit" className="button small" disabled={update.isPending}>
          Save
        </button>
        <button type="button" className="button ghost small" onClick={onDone}>
          Cancel
        </button>
      </div>
      <ErrorMessage error={update.error} />
      <LoadError queries={people} />
    </form>
  );
}

function AddComponentForm({ ideaId }: { ideaId: string }) {
  const add = useAddComponent(ideaId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(
      { title, notes: notes || null },
      {
        onSuccess: () => {
          setTitle('');
          setNotes('');
        },
      },
    );
  };

  return (
    <form className="row wrap end" onSubmit={submit} aria-label="Add component">
      <Field label="Add something it needs" error={fieldError(add.error, 'title')} className="grow">
        {(props) => (
          <input {...props} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Budget sign-off" />
        )}
      </Field>
      <Field label=<>Notes <span className="muted">(optional)</span></> className="grow">
        {(props) => (
          <input {...props} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <button type="submit" className="button" disabled={add.isPending}>
        Add
      </button>
      <ErrorMessage error={add.error} />
    </form>
  );
}
