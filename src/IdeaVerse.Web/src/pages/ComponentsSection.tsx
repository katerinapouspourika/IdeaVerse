import { GripVertical } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { SuggestComponents } from '../ai/SuggestComponents';
import { formatDate, todayIso } from '../api/dates';
import {
  useAddComponent,
  useComponents,
  useDeleteComponent,
  useReorderComponents,
  useUpdateComponent,
  useWorkspaceMembers,
} from '../api/queries';
import { personLabel, type Component } from '../api/types';
import { useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';

const componentDragType = 'application/x-ideaverse-component';

/** The idea's checklist; without `canEdit` it is read-only. */
export function ComponentsSection({ ideaId, workspaceId, canEdit }: { ideaId: string; workspaceId: string; canEdit: boolean }) {
  const components = useComponents(ideaId);
  const update = useUpdateComponent(ideaId);
  const remove = useDeleteComponent(ideaId);
  const add = useAddComponent(ideaId);
  const reorder = useReorderComponents(ideaId);
  const toast = useToast();
  const [announcement, setAnnouncement] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const refocus = useRef<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const moveHintId = useId();
  const canReorder = canEdit && (components.data?.length ?? 0) > 1;

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

  /** Removes a component straight away, offering Undo, which adds it back with its assignment, due date, and done state. */
  const removeComponent = (component: Component) =>
    remove.mutate(component.id, {
      onSuccess: () =>
        toast({
          message: `Removed “${component.title}”`,
          undo: () =>
            add.mutate(
              { title: component.title, notes: component.notes },
              {
                onSuccess: (created) => {
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
  /** Present when the list can be reordered. */
  reorder?: Reorder;
  onToggle: (isDone: boolean, onSettled: () => void) => void;
  onRemove: () => void;
}

/** A checklist row whose checkbox responds the moment it is clicked, before the API confirms the change. */
function ComponentItem({ ideaId, workspaceId, component, canEdit, reorder, onToggle, onRemove }: ComponentItemProps) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  // Only the handle starts a drag, so dragging across the label or a form field selects text as usual.
  const [dragArmed, setDragArmed] = useState(false);
  // A cancelled drag never leaves the row it was over, so the highlight shows only while a drag is under way.
  const highlighted = dropTarget && (reorder?.acceptsDrop ?? false);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Returns focus to Edit once the edit is saved or cancelled.
  useEffect(() => {
    if (wasEditing.current && !editing) {
      editButton.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);
  const checked = pending ?? component.isDone;
  const late = !component.isDone && component.dueDate !== null && component.dueDate < todayIso();

  const toggle = () => {
    setPending(!checked);
    onToggle(!checked, () => setPending(null));
  };

  const onHandleKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      reorder?.onKeyMove(event.key === 'ArrowUp' ? -1 : 1);
    }
  };

  if (editing) {
    return (
      <li>
        <EditComponentForm ideaId={ideaId} component={component} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li
      className={[checked ? 'done' : '', reorder?.dragging ? 'dragging' : '', highlighted ? 'drop-target' : ''].filter(Boolean).join(' ') || undefined}
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
        <label className="check">
          <input type="checkbox" checked={checked} onChange={toggle} disabled={!canEdit} />
          <span>
            <span className="check-title">{component.title}</span>
            {component.notes && <span className="muted small block">{component.notes}</span>}
            {(component.assigneeEmail || component.dueDate) && (
              <span className={late ? 'small block overdue-text' : 'muted small block'}>
                {component.assigneeEmail && personLabel(component.assigneeName, component.assigneeEmail)}
                {component.assigneeEmail && component.dueDate && ' · '}
                {component.dueDate && `due ${formatDate(component.dueDate)}`}
              </span>
            )}
          </span>
        </label>
        {canEdit && (
          <span className="row component-actions">
            <button ref={editButton} type="button" className="button ghost small" aria-label={`Edit ${component.title}`} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="button ghost small" aria-label={`Assign ${component.title}`} onClick={() => setAssigning(!assigning)}>
              Assign
            </button>
            <button type="button" className="button ghost small" aria-label={`Remove ${component.title}`} onClick={onRemove}>
              Remove
            </button>
          </span>
        )}
      </div>
      {assigning && <AssignForm ideaId={ideaId} workspaceId={workspaceId} component={component} onDone={() => setAssigning(false)} />}
    </li>
  );
}

/** Renames a component or changes its notes in place; Escape cancels. */
function EditComponentForm({ ideaId, component, onDone }: { ideaId: string; component: Component; onDone: () => void }) {
  const update = useUpdateComponent(ideaId);
  const [title, setTitle] = useState(component.title);
  const [notes, setNotes] = useState(component.notes ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        id: component.id,
        title,
        notes: notes || null,
        isDone: component.isDone,
        assigneeId: component.assigneeId,
        dueDate: component.dueDate,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form
      className="row wrap end"
      onSubmit={submit}
      aria-label={`Edit ${component.title}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <Field label="Title" error={fieldError(update.error, 'title')} className="grow">
        {(props) => <input {...props} required maxLength={200} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label=<>Notes <span className="muted">(optional)</span></> className="grow">
        {(props) => <input {...props} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <button type="submit" className="button small" disabled={update.isPending}>
        Save
      </button>
      <button type="button" className="button ghost small" onClick={onDone}>
        Cancel
      </button>
      <ErrorMessage error={update.error} />
    </form>
  );
}

/** Chooses who is responsible for a component and when it is due. */
function AssignForm({ ideaId, workspaceId, component, onDone }: { ideaId: string; workspaceId: string; component: Component; onDone: () => void }) {
  const people = useWorkspaceMembers(workspaceId);
  const update = useUpdateComponent(ideaId);
  const [assigneeId, setAssigneeId] = useState(component.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(component.dueDate ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        id: component.id,
        title: component.title,
        notes: component.notes,
        isDone: component.isDone,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form className="row wrap end assign-form" onSubmit={submit} aria-label={`Assign ${component.title}`}>
      <Field label="Assigned to" error={fieldError(update.error, 'assigneeId')} className="grow">
        {(props) => (
          <select {...props} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Nobody</option>
            {(people.data ?? []).map((person) => (
              <option key={person.userId} value={person.userId}>
                {personLabel(person.name, person.email)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Due">
        {(props) => <input {...props} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}
      </Field>
      <button type="submit" className="button small" disabled={update.isPending}>
        Save
      </button>
      <button type="button" className="button ghost small" onClick={onDone}>
        Cancel
      </button>
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
