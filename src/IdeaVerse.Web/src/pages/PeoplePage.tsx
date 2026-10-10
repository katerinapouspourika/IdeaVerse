import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { formatDate } from '../api/dates';
import {
  useChangeRole,
  useDeleteWorkspace,
  useTransferOwnership,
  useInvitations,
  useInvite,
  useRemoveWorkspaceMember,
  useRenameWorkspace,
  useRevokeInvitation,
  useWorkspaceMembers,
} from '../api/queries';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';

/** The current workspace's people and invitations; owners and admins manage them here. */
export function PeoplePage() {
  const { current, isLoading } = useWorkspace();

  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }

  if (!current) {
    return <Navigate to="/" replace />;
  }

  return <People key={current.id} workspace={current} />;
}

function People({ workspace }: { workspace: Workspace }) {
  const canManage = canManageWorkspace(workspace);

  return (
    <div className="stack">
      <WorkspaceName workspace={workspace} canManage={canManage} />
      <MemberList workspace={workspace} canManage={canManage} />
      {canManage ? (
        <>
          <InviteForm workspaceId={workspace.id} />
          <OpenInvitations workspaceId={workspace.id} />
        </>
      ) : (
        <p className="muted small">Only the workspace’s owner and admins can invite people.</p>
      )}
      {workspace.role === 'Owner' && <DangerZone workspace={workspace} />}
    </div>
  );
}

/** The owner's irreversible actions: handing the workspace over, and deleting it. */
function DangerZone({ workspace }: { workspace: Workspace }) {
  const members = useWorkspaceMembers(workspace.id);
  const transfer = useTransferOwnership(workspace.id);
  const remove = useDeleteWorkspace(workspace.id);
  const navigate = useNavigate();
  const [successor, setSuccessor] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const others = (members.data ?? []).filter((m) => m.role !== 'Owner');

  const handOver = (event: FormEvent) => {
    event.preventDefault();
    const person = others.find((m) => m.userId === successor);
    if (person && window.confirm(`Make ${person.email} the owner of ${workspace.name}? You will stay as an admin.`)) {
      transfer.mutate(successor, { onSuccess: () => setSuccessor('') });
    }
  };

  const deleteWorkspace = (event: FormEvent) => {
    event.preventDefault();
    remove.mutate(undefined, { onSuccess: () => void navigate('/') });
  };

  return (
    <section className="card danger stack" aria-labelledby="danger-heading">
      <h2 id="danger-heading">Danger zone</h2>
      <form className="stack" onSubmit={handOver} aria-label="Transfer ownership">
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
                      {m.email}
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

function WorkspaceName({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) {
  const rename = useRenameWorkspace(workspace.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workspace.name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    rename.mutate(name, { onSuccess: () => setEditing(false) });
  };

  if (editing) {
    return (
      <form className="card stack" onSubmit={submit} aria-label="Rename workspace">
        <Field label="Workspace name" error={fieldError(rename.error, 'name')}>
          {(props) => <input {...props} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <ErrorMessage error={rename.error} />
        <div className="row">
          <button type="submit" className="button primary" disabled={rename.isPending}>
            Save
          </button>
          <button type="button" className="button ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="row spread wrap">
      <h1>People in {workspace.name}</h1>
      {canManage && (
        <button type="button" className="button ghost" onClick={() => setEditing(true)}>
          Rename
        </button>
      )}
    </div>
  );
}

function MemberList({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) {
  const members = useWorkspaceMembers(workspace.id);
  const changeRole = useChangeRole(workspace.id);
  const remove = useRemoveWorkspaceMember(workspace.id);
  const { account } = useAuth();
  const navigate = useNavigate();

  const removeMember = (member: WorkspaceMember, leaving: boolean) => {
    const question = leaving
      ? `Leave ${workspace.name}? You will no longer see its ideas, and you will be taken off their teams.`
      : `Remove ${member.email} from ${workspace.name}? They will be taken off the teams of its ideas.`;
    if (window.confirm(question)) {
      remove.mutate(member.userId, { onSuccess: () => (leaving ? void navigate('/') : undefined) });
    }
  };

  return (
    <section className="card stack" aria-labelledby="members-heading">
      <h2 id="members-heading">Members</h2>
      {members.isLoading && <p className="muted">Loading…</p>}
      {members.data && (
        <ul className="team">
          {members.data.map((member) => {
            const isMe = member.email === account?.email;
            const isOwner = member.role === 'Owner';
            return (
              <li key={member.userId}>
                <span>
                  {member.email}
                  {isMe && <span className="muted"> (you)</span>}
                </span>
                <span className="row">
                  {canManage && !isOwner ? (
                    <select
                      aria-label={`Role of ${member.email}`}
                      value={member.role}
                      disabled={changeRole.isPending}
                      onChange={(e) => changeRole.mutate({ userId: member.userId, role: e.target.value as WorkspaceRole })}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                    </select>
                  ) : (
                    <span className="badge">{member.role}</span>
                  )}
                  {!isOwner && (isMe || canManage) && (
                    <button
                      type="button"
                      className="button ghost small"
                      aria-label={isMe ? 'Leave workspace' : `Remove ${member.email}`}
                      onClick={() => removeMember(member, isMe)}
                    >
                      {isMe ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorMessage error={members.error ?? changeRole.error ?? remove.error} />
    </section>
  );
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
  const invite = useInvite(workspaceId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('Member');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSentTo(null);
    invite.mutate(
      { email, role },
      {
        onSuccess: (invitation) => {
          setSentTo(invitation.email);
          setEmail('');
        },
      },
    );
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Invite people">
      <h2>Invite people</h2>
      <p className="muted small">They get an email with a link. People without an account sign up with that address and find the invitation waiting.</p>
      <div className="row wrap end">
        <Field label="Email" error={fieldError(invite.error, 'email')} className="grow">
          {(props) => (
            <input {...props} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
          )}
        </Field>
        <Field label="Role" error={fieldError(invite.error, 'role')}>
          {(props) => (
            <select {...props} value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
              <option value="Member">Member</option>
              <option value="Admin">Admin</option>
            </select>
          )}
        </Field>
        <button type="submit" className="button primary" disabled={invite.isPending}>
          {invite.isPending ? 'Sending…' : 'Send invitation'}
        </button>
      </div>
      {sentTo && (
        <p role="status" className="success">
          Invitation sent to {sentTo}.
        </p>
      )}
      <ErrorMessage error={invite.error} />
    </form>
  );
}

function OpenInvitations({ workspaceId }: { workspaceId: string }) {
  const invitations = useInvitations(workspaceId, true);
  const revoke = useRevokeInvitation(workspaceId);

  if (!invitations.data?.length) {
    return <ErrorMessage error={invitations.error} />;
  }

  return (
    <section className="card stack" aria-labelledby="open-invitations-heading">
      <h2 id="open-invitations-heading">Waiting to join</h2>
      <ul className="team">
        {invitations.data.map((invitation) => (
          <li key={invitation.id}>
            <span>
              {invitation.email}
              <span className="muted small block">
                {invitation.role} · invited by {invitation.invitedByEmail} · until {formatDate(invitation.expiresAt.slice(0, 10))}
              </span>
            </span>
            <button
              type="button"
              className="button ghost small"
              aria-label={`Revoke invitation for ${invitation.email}`}
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(invitation.id)}
            >
              Revoke
            </button>
          </li>
        ))}
      </ul>
      <ErrorMessage error={revoke.error} />
    </section>
  );
}
