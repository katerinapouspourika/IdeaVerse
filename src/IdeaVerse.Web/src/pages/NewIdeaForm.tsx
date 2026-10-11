import { useState, type FormEvent } from 'react';

import { addDays, todayIso } from '../api/dates';
import { useCreateIdea } from '../api/queries';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { parseTags } from '../components/tagInput';

interface NewIdeaFormProps {
  workspaceId: string;
  /** Title and description to start from, such as a brainstormed idea's. */
  initial?: { title: string; description: string };
  onDone: () => void;
}

export function NewIdeaForm({ workspaceId, initial, onDone }: NewIdeaFormProps) {
  const create = useCreateIdea(workspaceId);
  const today = todayIso();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [targetDate, setTargetDate] = useState(addDays(today, 14));
  const [tags, setTags] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      { title, description: description || null, targetDate, tags: parseTags(tags) },
      { onSuccess: onDone },
    );
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="New idea">
      <h2>New idea</h2>
      <Field label="Title" error={fieldError(create.error, 'title')}>
        {(props) => (
          <input {...props} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Black Friday teaser campaign" />
        )}
      </Field>
      <Field label="Implement by" error={fieldError(create.error, 'targetDate')}>
        {(props) => (
          <input {...props} type="date" required min={today} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        )}
      </Field>
      <Field label=<>Description <span className="muted">(optional)</span></>>
        {(props) => (
          <textarea {...props} rows={3} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <Field label=<>Tags <span className="muted">(optional)</span></> hint="Separate tags with commas." error={fieldError(create.error, 'tags')}>
        {(props) => <input {...props} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. marketing, q4" />}
      </Field>
      <ErrorMessage error={create.error} />
      <div className="row">
        <button type="submit" className="button primary" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Add idea'}
        </button>
        <button type="button" className="button ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

