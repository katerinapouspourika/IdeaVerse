import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useCreateWorkspace } from '../api/queries';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { useWorkspace } from './WorkspaceContext';

/** Creates a workspace owned by the user, then opens it. */
export function CreateWorkspaceForm({ onCancel }: { onCancel?: () => void }) {
  const create = useCreateWorkspace();
  const { select } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(name, {
      onSuccess: (workspace) => {
        select(workspace.id);
        void navigate('/');
      },
    });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Create workspace">
      <h2>Create a workspace</h2>
      <p className="muted small">A workspace holds your company’s or team’s ideas. You can invite people once it exists.</p>
      <Field label="Workspace name" error={fieldError(create.error, 'name')}>
        {(props) => (
          <input {...props} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Marketing" />
        )}
      </Field>
      <ErrorMessage error={create.error} />
      <div className="row">
        <button type="submit" className="button primary" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create workspace'}
        </button>
        {onCancel && (
          <button type="button" className="button ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
