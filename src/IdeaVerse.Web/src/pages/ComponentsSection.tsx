import { useState, type FormEvent } from 'react';

import { SuggestComponents } from '../ai/SuggestComponents';
import { formatDate, todayIso } from '../api/dates';
import { useAddComponent, useComponents, useDeleteComponent, useUpdateComponent, useWorkspaceMembers } from '../api/queries';
import { personLabel, type Component } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

/** The idea's checklist; without `canEdit` it is read-only. */
export function ComponentsSection({ ideaId, workspaceId, canEdit }: { ideaId: string; workspaceId: string; canEdit: boolean }) {
  const components = useComponents(ideaId);
  const update = useUpdateComponent(ideaId);
  const remove = useDeleteComponent(ideaId);

  return (
    <section className="card stack" aria-labelledby="components-heading">
      <h2 id="components-heading">What it needs</h2>
      <p className="muted small">Components are the things that must be in place before this idea can happen.</p>
      {components.isLoading && <p className="muted">Loading…</p>}
      {components.data?.length === 0 && <p className="muted">Nothing listed yet.</p>}
      {components.data && components.data.length > 0 && (
        <ul className="checklist">
          {components.data.map((component) => (
            <ComponentItem
              key={component.id}
              ideaId={ideaId}
              workspaceId={workspaceId}
              component={component}
              canEdit={canEdit}
              onToggle={(isDone, onSettled) =>
                update.mutate(
                  { id: component.id, title: component.title, notes: component.notes, isDone, assigneeId: component.assigneeId, dueDate: component.dueDate },
                  { onSettled },
                )
              }
              onRemove={() => remove.mutate(component.id)}
            />
          ))}
        </ul>
      )}
      <ErrorMessage error={components.error ?? update.error ?? remove.error} />
      {canEdit && <AddComponentForm ideaId={ideaId} />}
      {canEdit && <SuggestComponents ideaId={ideaId} workspaceId={workspaceId} />}
    </section>
  );
}

interface ComponentItemProps {
  ideaId: string;
  workspaceId: string;
  component: Component;
  canEdit: boolean;
  onToggle: (isDone: boolean, onSettled: () => void) => void;
  onRemove: () => void;
}

/** A checklist row whose checkbox responds the moment it is clicked, before the API confirms the change. */
function ComponentItem({ ideaId, workspaceId, component, canEdit, onToggle, onRemove }: ComponentItemProps) {
  const [pending, setPending] = useState<boolean | null>(null);
  const [assigning, setAssigning] = useState(false);
  const checked = pending ?? component.isDone;
  const late = !component.isDone && component.dueDate !== null && component.dueDate < todayIso();

  const toggle = () => {
    setPending(!checked);
    onToggle(!checked, () => setPending(null));
  };

  return (
    <li className={checked ? 'done' : undefined}>
      <div className="row spread wrap">
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
          <span className="row">
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
      <ErrorMessage error={update.error ?? people.error} />
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
