import { Palette } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { formatDate } from '../api/dates';
import {
  useChangeRole,
  useDeleteWorkspace,
  useTransferOwnership,
  useInvitations,
  useInvite,
  useRemoveWorkspaceMember,
  useRenameWorkspace,
  useResendInvitation,
  useRevokeInvitation,
  useWorkspaceMembers,
} from '../api/queries';
import { personLabel, type Invitation, type Workspace, type WorkspaceMember, type WorkspaceRole } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';
import { useConfirm, useToast } from '../components/Feedback';
import { Skeleton } from '../components/Skeleton';
import { usePageMeta } from '../seo/usePageMeta';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';
import { CompanyDomainCard } from '../workspaces/CompanyDomainCard';
import { InviteLinkCard } from '../workspaces/InviteLinkCard';
import { JoinRequestsCard } from '../workspaces/JoinRequestsCard';

/** The current workspace's people and invitations; owners and admins manage them here. */
export function PeoplePage() {
  usePageMeta('People', { index: false });
  const { current, isLoading } = useWorkspace();

  if (isLoading) {
    return <Skeleton variant="page" lines={4} />;
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
          <JoinRequestsCard workspaceId={workspace.id} />
          <InviteLinkCard workspaceId={workspace.id} />
          <CompanyDomainCard workspaceId={workspace.id} />
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
        <div className="row wrap">
          <button type="button" className="button ghost" onClick={() => setEditing(true)}>
            Rename
          </button>
          {/* The workspace's look lives with its other settings; this keeps it easy to find from here. */}
          <Link to="/settings#workspace" className="button ghost">
            <Palette aria-hidden="true" size={18} />
            Logo and colour
          </Link>
        </div>
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
  const confirm = useConfirm();
  const toast = useToast();

  const changeRoleOf = async (member: WorkspaceMember, role: WorkspaceRole) => {
    const name = personLabel(member.name, member.email);
    const ok = await confirm(
      role === 'Admin'
        ? {
            title: `Make ${name} an admin?`,
            message: `They will be able to invite and remove people, change roles, and manage every idea in ${workspace.name}.`,
            confirmLabel: 'Make admin',
          }
        : {
            title: `Make ${name} a member?`,
            message: 'They will no longer manage people or other people’s ideas, and the invitations they sent will be revoked.',
            confirmLabel: 'Make member',
          },
    );
    if (ok) {
      changeRole.mutate(
        { userId: member.userId, role },
        { onSuccess: () => toast({ message: `${name} is now ${role === 'Admin' ? 'an admin' : 'a member'}`, tone: 'success' }) },
      );
    }
  };

  const removeMember = async (member: WorkspaceMember, leaving: boolean) => {
    const name = personLabel(member.name, member.email);
    const ok = await confirm(
      leaving
        ? { title: `Leave ${workspace.name}?`, message: 'You will no longer see its ideas, and you will be taken off their teams.', confirmLabel: 'Leave workspace', danger: true }
        : { title: `Remove ${name}?`, message: `They will lose access to ${workspace.name} and be taken off the teams of its ideas.`, confirmLabel: 'Remove', danger: true },
    );
    if (ok) {
      remove.mutate(member.userId, {
        onSuccess: () => {
          toast({ message: leaving ? `You left ${workspace.name}` : `Removed ${name}` });
          if (leaving) {
            void navigate('/');
          }
        },
      });
    }
  };

  return (
    <section className="card stack" aria-labelledby="members-heading">
      <h2 id="members-heading">Members</h2>
      {members.isLoading && <Skeleton lines={3} />}
      {members.data && (
        <ul className="team">
          {members.data.map((member) => {
            const isMe = member.email === account?.email;
            const isOwner = member.role === 'Owner';
            return (
              <li key={member.userId}>
                <span>
                  {personLabel(member.name, member.email)}
                  {isMe && <span className="muted"> (you)</span>}
                  {member.name && <span className="muted small block">{member.email}</span>}
                </span>
                <span className="row">
                  {canManage && !isOwner && !isMe ? (
                    <select
                      aria-label={`Role of ${personLabel(member.name, member.email)}`}
                      value={member.role}
                      disabled={changeRole.isPending}
                      onChange={(e) => void changeRoleOf(member, e.target.value as WorkspaceRole)}
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
                      aria-label={isMe ? 'Leave workspace' : `Remove ${personLabel(member.name, member.email)}`}
                      onClick={() => void removeMember(member, isMe)}
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
      <LoadError queries={members} />
      <ErrorMessage error={changeRole.error ?? remove.error} />
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
  const resend = useResendInvitation(workspaceId);
  const revoke = useRevokeInvitation(workspaceId);
  const toast = useToast();

  const resendTo = (invitation: Invitation) =>
    resend.mutate(invitation.id, { onSuccess: () => toast({ message: `Invitation sent again to ${invitation.email}`, tone: 'success' }) });

  if (!invitations.data?.length) {
    return <LoadError queries={invitations} />;
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
                {invitation.role} · invited by {personLabel(invitation.invitedByName, invitation.invitedByEmail)} · until {formatDate(invitation.expiresAt.slice(0, 10))}
              </span>
            </span>
            <span className="row">
              <button
                type="button"
                className="button ghost small"
                aria-label={`Resend invitation to ${invitation.email}`}
                disabled={resend.isPending}
                onClick={() => resendTo(invitation)}
              >
                Resend
              </button>
              <button
                type="button"
                className="button ghost small"
                aria-label={`Revoke invitation for ${invitation.email}`}
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(invitation.id)}
              >
                Revoke
              </button>
            </span>
          </li>
        ))}
      </ul>
      <ErrorMessage error={resend.error ?? revoke.error} />
    </section>
  );
}
