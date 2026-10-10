import { useState, type FormEvent } from 'react';

import { useAddComponent, useComponents, useDeleteComponent, useUpdateComponent } from '../api/queries';
import type { Component } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

/** The idea's checklist; without `canEdit` it is read-only. */
export function ComponentsSection({ ideaId, canEdit }: { ideaId: string; canEdit: boolean }) {
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
              component={component}
              canEdit={canEdit}
              onToggle={(isDone, onSettled) =>
                update.mutate({ id: component.id, title: component.title, notes: component.notes, isDone }, { onSettled })
              }
              onRemove={() => remove.mutate(component.id)}
            />
          ))}
        </ul>
      )}
      <ErrorMessage error={components.error ?? update.error ?? remove.error} />
      {canEdit && <AddComponentForm ideaId={ideaId} />}
    </section>
  );
}

interface ComponentItemProps {
  component: Component;
  canEdit: boolean;
  onToggle: (isDone: boolean, onSettled: () => void) => void;
  onRemove: () => void;
}

/** A checklist row whose checkbox responds the moment it is clicked, before the API confirms the change. */
function ComponentItem({ component, canEdit, onToggle, onRemove }: ComponentItemProps) {
  const [pending, setPending] = useState<boolean | null>(null);
  const checked = pending ?? component.isDone;

  const toggle = () => {
    setPending(!checked);
    onToggle(!checked, () => setPending(null));
  };

  return (
    <li className={checked ? 'done' : undefined}>
      <label className="check">
        <input type="checkbox" checked={checked} onChange={toggle} disabled={!canEdit} />
        <span>
          <span className="check-title">{component.title}</span>
          {component.notes && <span className="muted small block">{component.notes}</span>}
        </span>
      </label>
      {canEdit && (
        <button type="button" className="button ghost small" aria-label={`Remove ${component.title}`} onClick={onRemove}>
          Remove
        </button>
      )}
    </li>
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
