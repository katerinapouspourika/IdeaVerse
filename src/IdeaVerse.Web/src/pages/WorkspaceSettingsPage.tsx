import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { useDeleteWorkspace, useRenameWorkspace, useTransferOwnership, useWorkspaceMembers } from '../api/queries';
import { personLabel, type Workspace } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { useConfirm, useToast } from '../components/Feedback';
import { Skeleton } from '../components/Skeleton';
import { requiredProblem, useInlineValidation } from '../components/useInlineValidation';
import { usePageMeta } from '../seo/usePageMeta';
import { BrandingCard } from '../workspaces/BrandingCard';
import { CompanyDomainCard } from '../workspaces/CompanyDomainCard';
import { InviteLinkCard } from '../workspaces/InviteLinkCard';
import { WorkspaceBadge } from '../workspaces/WorkspaceBadge';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';

/**
 * The current workspace's settings, which apply to everyone in it: its name, logo and colour, invite link, company domain,
 * and the owner's danger zone. Owners and admins change them; everyone else is told who can. People links here.
 */
export function WorkspaceSettingsPage() {
  usePageMeta('Workspace settings', { index: false });
  const { current, isLoading } = useWorkspace();

  if (isLoading) {
    return <Skeleton variant="page" lines={4} />;
  }

  if (!current) {
    return <Navigate to="/" replace />;
  }

  return <WorkspaceSettings key={current.id} workspace={current} />;
}

function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  if (!canManageWorkspace(workspace)) {
    return (
      <div className="stack">
        <h1>Workspace settings</h1>
        <section className="card stack" aria-label="Workspace">
          <div className="row">
            <WorkspaceBadge workspace={workspace} size={40} />
            <strong>{workspace.name}</strong>
          </div>
          <p className="muted small">
            Only the workspace’s owner and admins can change its name, look, invite link, and company domain. You’ll find them on{' '}
            <Link to="/people">People</Link>.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="stack tight">
        <h1>Workspace settings</h1>
        <p className="muted small">
          These apply to everyone in {workspace.name}. Manage who is in it on <Link to="/people">People</Link>.
        </p>
      </div>
      <WorkspaceName workspace={workspace} />
      <BrandingCard workspace={workspace} />
      <InviteLinkCard workspaceId={workspace.id} />
      <CompanyDomainCard workspaceId={workspace.id} />
      {workspace.role === 'Owner' && <DangerZone workspace={workspace} />}
    </div>
  );
}

function WorkspaceName({ workspace }: { workspace: Workspace }) {
  const rename = useRenameWorkspace(workspace.id);
  const [name, setName] = useState(workspace.name);
  const [saved, setSaved] = useState(false);
  const validation = useInlineValidation({ name: () => requiredProblem(name, 'Give your workspace a name.') });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validation.validate(event)) {
      return;
    }
    setSaved(false);
    rename.mutate(name, { onSuccess: () => setSaved(true) });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Rename workspace" noValidate>
      <h2>Name</h2>
      <Field label="Workspace name" error={validation.errors.name ?? fieldError(rename.error, 'name')}>
        {(props) => <input {...props} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} onBlur={validation.blur('name')} />}
      </Field>
      <ErrorMessage error={rename.error} />
      {saved && (
        <p role="status" className="success">
          Saved.
        </p>
      )}
      <div className="row">
        <button type="submit" className="button primary" disabled={rename.isPending || name.trim() === workspace.name}>
          Save
        </button>
      </div>
    </form>
  );
}

/** The owner's irreversible actions: handing the workspace over, and deleting it. */
function DangerZone({ workspace }: { workspace: Workspace }) {
  const members = useWorkspaceMembers(workspace.id);
  const transfer = useTransferOwnership(workspace.id);
  const remove = useDeleteWorkspace(workspace.id);
  const navigate = useNavigate();
  const [successor, setSuccessor] = useState('');
  const confirm = useConfirm();
  const toast = useToast();
  const [confirmName, setConfirmName] = useState('');
  const others = (members.data ?? []).filter((m) => m.role !== 'Owner');

  const handOver = async (event: FormEvent) => {
    event.preventDefault();
    const person = others.find((m) => m.userId === successor);
    const name = person && personLabel(person.name, person.email);
    if (person && (await confirm({ title: `Make ${name} the owner?`, message: `${name} will own ${workspace.name}. You will stay as an admin.`, confirmLabel: 'Hand over' }))) {
      transfer.mutate(successor, {
        onSuccess: () => {
          setSuccessor('');
          toast({ message: `${name} now owns ${workspace.name}` });
        },
      });
    }
  };

  const deleteWorkspace = (event: FormEvent) => {
    event.preventDefault();
    remove.mutate(undefined, { onSuccess: () => void navigate('/') });
  };

  return (
    <section className="card danger stack" aria-labelledby="danger-heading">
      <h2 id="danger-heading">Danger zone</h2>
      <form className="stack" onSubmit={(event) => void handOver(event)} aria-label="Transfer ownership">
        <p className="muted small">Hand the workspace to someone else in it. You stay on as an admin and can then leave.</p>
        {others.length === 0 ? (
          <p className="muted small">Invite someone first; there is nobody to hand it to yet.</p>
        ) : (
          <div className="row wrap end">
            <Field label="New owner" className="grow">
              {(props) => (
                <select {...props} required value={successor} onChange={(e) => setSuccessor(e.target.value)}>
                  <option value="">Choose a person…</option>
                  {others.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name ? `${m.name} (${m.email})` : m.email}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <button type="submit" className="button" disabled={!successor || transfer.isPending}>
              Transfer ownership
            </button>
          </div>
        )}
        <ErrorMessage error={transfer.error} />
      </form>
      <form className="stack" onSubmit={deleteWorkspace} aria-label="Delete workspace">
        <p className="muted small">
          Deleting removes every idea, component, team, reminder, and invitation in {workspace.name}, for everyone. It cannot be undone.
        </p>
        <div className="row wrap end">
          <Field label={`Type “${workspace.name}” to confirm`} className="grow">
            {(props) => <input {...props} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />}
          </Field>
          <button type="submit" className="button danger" disabled={confirmName.trim() !== workspace.name || remove.isPending}>
            Delete workspace
          </button>
        </div>
        <ErrorMessage error={remove.error} />
      </form>
    </section>
  );
}
