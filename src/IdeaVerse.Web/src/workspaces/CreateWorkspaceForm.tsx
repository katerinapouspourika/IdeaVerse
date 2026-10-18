import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useCreateWorkspace } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { requiredProblem, useInlineValidation } from '../components/useInlineValidation';
import { useWorkspace } from './WorkspaceContext';

/**
 * Creates a workspace owned by the user, opens it, and moves on to inviting the team. `onCreated` runs first, so
 * the page holding the form can stand aside while the invite step opens. With `askName`, for a first workspace, it
 * also asks for the user's own name, so teammates they invite next see that rather than their email address.
 */
export function CreateWorkspaceForm({
  onCancel,
  onCreated,
  heading = 'Create a workspace',
  askName = false,
}: {
  onCancel?: () => void;
  onCreated?: () => void;
  heading?: string;
  askName?: boolean;
}) {
  const create = useCreateWorkspace();
  const { account, updateDisplayName } = useAuth();
  const { select } = useWorkspace();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const validation = useInlineValidation({ name: () => requiredProblem(name, 'Give your workspace a name.') });
  const [yourName, setYourName] = useState(account?.displayName ?? '');
  const [nameError, setNameError] = useState<unknown>(null);
  const [savingName, setSavingName] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
    // Left blank, the user keeps going by their email address; a name already set is saved again only if changed.
    const chosen = yourName.trim();
    if (askName && chosen !== '' && chosen !== (account?.displayName ?? '')) {
      setNameError(null);
      setSavingName(true);
      try {
        await updateDisplayName(chosen);
      } catch (error) {
        setNameError(error);
        return;
      } finally {
        setSavingName(false);
      }
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
    <form className="card stack" onSubmit={(event) => void submit(event)} aria-label="Create workspace" noValidate>
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
      {askName && (
        <Field label="Your name" hint="Optional. Your team sees it instead of your email address." error={fieldError(nameError, 'displayName')}>
          {(props) => (
            <input {...props} maxLength={100} autoComplete="name" value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="e.g. Alex Morgan" />
          )}
        </Field>
      )}
      <ErrorMessage error={nameError} />
      <ErrorMessage error={create.error} />
      <div className="row">
        <button type="submit" className="button primary" disabled={savingName || create.isPending}>
          {savingName || create.isPending ? 'Creating…' : 'Create workspace'}
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
