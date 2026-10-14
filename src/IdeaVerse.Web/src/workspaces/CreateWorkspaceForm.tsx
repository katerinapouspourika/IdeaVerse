import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useCreateWorkspace } from '../api/queries';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { requiredProblem, useInlineValidation } from '../components/useInlineValidation';
import { useWorkspace } from './WorkspaceContext';

/**
 * Creates a workspace owned by the user, opens it, and moves on to inviting the team. `onCreated` runs first, so
 * the page holding the form can stand aside while the invite step opens.
 */
export function CreateWorkspaceForm({
  onCancel,
  onCreated,
  heading = 'Create a workspace',
}: {
  onCancel?: () => void;
  onCreated?: () => void;
  heading?: string;
}) {
  const create = useCreateWorkspace();
  const { select } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const validation = useInlineValidation({ name: () => requiredProblem(name, 'Give your workspace a name.') });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
    create.mutate(name, {
      onSuccess: (workspace) => {
        onCreated?.();
        select(workspace.id);
        void navigate(`/workspaces/${workspace.id}/invite`);
      },
    });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Create workspace" noValidate>
      <h2>{heading}</h2>
      <p className="muted small">A workspace holds your company’s or team’s ideas. Name it after your company or team, and change it any time.</p>
      <Field label="Workspace name" error={validation.errors.name ?? fieldError(create.error, 'name')}>
        {(props) => (
          <input
            {...props}
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={validation.blur('name')}
            placeholder="e.g. Acme Marketing"
          />
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
