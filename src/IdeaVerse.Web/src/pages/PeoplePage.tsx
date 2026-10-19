import { Settings } from 'lucide-react';
import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';

import { formatDayOf } from '../api/dates';
import {
  useChangeRole,
  useInvitations,
  useInvite,
  useRemoveWorkspaceMember,
  useResendInvitation,
  useRevokeInvitation,
  useWorkspaceMembers,
} from '../api/queries';
import { personLabel, type Invitation, type Workspace, type WorkspaceMember, type WorkspaceRole } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { Person } from '../components/Person';
import { ErrorMessage, LoadError } from '../components/ErrorMessage';
import { useConfirm, useToast } from '../components/Feedback';
import { Skeleton } from '../components/Skeleton';
import { emailProblem } from '../components/useInlineValidation';
import { usePageMeta } from '../seo/usePageMeta';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';
import { EmailListInput, type EmailChip } from '../workspaces/EmailListInput';
import { JoinRequestsCard } from '../workspaces/JoinRequestsCard';
import { sendInvitations, splitEmails } from '../workspaces/sendInvitations';

/** The current workspace's people and invitations; owners and admins manage them here. */
export function PeoplePage() {
  usePageMeta('People', { index: false });
  const { all, current, isLoading, select } = useWorkspace();
  const [params, setParams] = useSearchParams();
  // Emails about a workspace's people link here as `?workspace={id}`, so they open on that workspace whichever was last chosen.
  const linked = params.get('workspace');
  const linkedWorkspace = all.find((w) => w.id === linked);

  useEffect(() => {
    if (linked === null || isLoading) {
      return;
    }
    if (linkedWorkspace && current?.id !== linkedWorkspace.id) {
      select(linkedWorkspace.id);
    }
    setParams({}, { replace: true });
  }, [linked, linkedWorkspace, current, isLoading, select, setParams]);

  if (isLoading || (linkedWorkspace && current?.id !== linkedWorkspace.id)) {
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
      <PeopleHeading workspace={workspace} canManage={canManage} />
      {canManage && <JoinRequestsCard workspaceId={workspace.id} />}
      <MemberList workspace={workspace} canManage={canManage} />
      {canManage ? (
        <>
          <InviteForm workspaceId={workspace.id} />
          <OpenInvitations workspaceId={workspace.id} />
        </>
      ) : (
        <AskToInvite workspaceId={workspace.id} />
      )}
    </div>
  );
}

/** Tells a member who can invite people, by name, with their addresses to write to. */
function AskToInvite({ workspaceId }: { workspaceId: string }) {
  const members = useWorkspaceMembers(workspaceId);
  const managers = (members.data ?? []).filter((m) => m.role === 'Owner' || m.role === 'Admin');

  if (managers.length === 0) {
    return <p className="muted small">Only the workspace’s owner and admins can invite people.</p>;
  }

  return (
    <p className="muted small">
      To invite someone, ask{' '}
      {managers.map((m, i) => (
        <Fragment key={m.userId}>
          {i > 0 && (i === managers.length - 1 ? ' or ' : ', ')}
          <a href={`mailto:${m.email}`}>{personLabel(m.name, m.email)}</a>
        </Fragment>
      ))}
      .
    </p>
  );
}

/** What each workspace role may do, as the API enforces it. */
const roleAbilities: { role: WorkspaceRole; can: string }[] = [
  {
    role: 'Owner',
    can: 'Everything an admin can, plus hand the workspace to someone else or delete it. There is one owner, who can’t leave until they hand it over.',
  },
  {
    role: 'Admin',
    can: 'Invite people, answer join requests, remove people and change their roles, rename and brand the workspace, and edit, archive or delete any idea in it.',
  },
  {
    role: 'Member',
    can: 'See and discuss every idea, create their own, and edit the ones they own or are on the team of; they archive or delete only their own.',
  },
];

function RoleGuide() {
  return (
    <details className="role-guide small">
      <summary>What can each role do?</summary>
      <dl>
        {roleAbilities.map(({ role, can }) => (
          <Fragment key={role}>
            <dt>{role}</dt>
            <dd className="muted">{can}</dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}

function PeopleHeading({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) {
  return (
    <div className="row spread wrap">
      <h1>People in {workspace.name}</h1>
      {canManage && (
        // The workspace's name, look, invite link and company domain live on their own page; this keeps them easy to find from here.
        <Link to="/workspace/settings" className="button ghost">
          <Settings aria-hidden="true" size={18} />
          Workspace settings
        </Link>
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
                <Person name={member.name} email={member.email} after={isMe && <span className="muted"> (you)</span>} />
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
      <RoleGuide />
      <LoadError queries={members} />
      <ErrorMessage error={changeRole.error ?? remove.error} />
    </section>
  );
}

/** Adds addresses to the list, leaving out any already in it (in any case); returns the new list and those left out. */
function merge(chips: Sent[], emails: string[]) {
  const next = [...chips];
  const repeated: string[] = [];
  for (const email of emails) {
    if (next.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
      repeated.push(email);
    } else {
      next.push({ email });
    }
  }
  return { next, repeated };
}

/** An address in the invite list and, once sent, why the API refused it. */
interface Sent {
  email: string;
  error?: string;
}

/** Invites one or many people at once with the same role; each address is checked here first, and sent on its own. */
function InviteForm({ workspaceId }: { workspaceId: string }) {
  const invite = useInvite(workspaceId);
  const members = useWorkspaceMembers(workspaceId);
  const invitations = useInvitations(workspaceId, true);
  const [chips, setChips] = useState<Sent[]>([]);
  const [text, setText] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('Member');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [repeated, setRepeated] = useState<string[]>([]);
  const [missing, setMissing] = useState<string | undefined>();
  const memberEmails = new Set((members.data ?? []).map((m) => m.email.toLowerCase()));
  const invitedEmails = new Set((invitations.data ?? []).map((i) => i.email.toLowerCase()));

  const problemOf = ({ email, error }: Sent) =>
    error ??
    (emailProblem(email)
      ? 'Not a valid email address.'
      : memberEmails.has(email.toLowerCase())
        ? 'Already in the workspace.'
        : invitedEmails.has(email.toLowerCase())
          ? 'Already invited. Resend it from Pending invitations.'
          : undefined);
  const shown: EmailChip[] = chips.map((chip) => ({ email: chip.email, problem: problemOf(chip) }));
  const problems = shown.filter((chip) => chip.problem);
  const ready = chips.filter((chip) => !problemOf(chip));

  const add = (emails: string[]) => {
    const merged = merge(chips, emails);
    setChips(merged.next);
    setRepeated(merged.repeated);
    setSentTo([]);
    setMissing(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Whatever is still typed in the box goes too.
    const { next, repeated: typedAgain } = merge(chips, splitEmails(text));
    setText('');
    setChips(next);
    setRepeated(typedAgain);
    setSentTo([]);
    const sendable = next.filter((chip) => !problemOf(chip));
    if (sendable.length === 0) {
      setMissing(next.length === 0 ? 'Enter the email addresses to invite.' : 'None of these addresses can be invited yet; see why below.');
      return;
    }
    setMissing(undefined);
    setSending(true);
    const results = await sendInvitations(invite.mutateAsync, sendable.map((chip) => chip.email), role);
    setSending(false);
    const sent = results.filter((r) => !r.error).map((r) => r.email);
    // Sent addresses leave the list; refused ones stay with the API's reason, beside any that weren't sent.
    setChips(next.filter((chip) => !sent.includes(chip.email)).map((chip) => ({ ...chip, error: results.find((r) => r.email === chip.email)?.error ?? chip.error })));
    setSentTo(sent);
  };

  return (
    <form className="card stack" onSubmit={(event) => void submit(event)} aria-label="Invite people" noValidate>
      <h2>Invite people</h2>
      <p className="muted small">They get an email with a link. People without an account sign up with that address and find the invitation waiting.</p>
      <div className="row wrap end">
        <Field
          label="Email addresses"
          hint="Paste a list, or separate addresses with commas, spaces, or new lines."
          error={missing}
          className="grow"
        >
          {(props) => (
            <EmailListInput
              {...props}
              chips={shown}
              text={text}
              onTextChange={(value) => {
                setText(value);
                setMissing(undefined);
              }}
              onAdd={add}
              onRemove={(email) => {
                setChips((all) => all.filter((c) => c.email !== email));
                setRepeated([]);
              }}
            />
          )}
        </Field>
        <Field label="Role">
          {(props) => (
            <select {...props} value={role} onChange={(e) => setRole(e.target.value as WorkspaceRole)}>
              <option value="Member">Member</option>
              <option value="Admin">Admin</option>
            </select>
          )}
        </Field>
        <button type="submit" className="button primary" disabled={sending}>
          {sending ? 'Sending…' : ready.length > 1 ? `Send ${ready.length} invitations` : 'Send invitation'}
        </button>
      </div>
      {repeated.length > 0 && (
        <p className="muted small" role="note">
          Already in the list, so left out: {repeated.join(', ')}.
        </p>
      )}
      {problems.length > 0 && (
        <div className="stack tight" aria-live="polite">
          <p className="error small">{problems.length === 1 ? 'This address won’t be invited:' : `These ${problems.length} addresses won’t be invited:`}</p>
          <ul className="invite-problems small" aria-label="Addresses not invited">
            {problems.map((chip) => (
              <li key={chip.email}>
                <strong>{chip.email}</strong> — {chip.problem}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sentTo.length > 0 && (
        <p role="status" className="success">
          {sentTo.length === 1 ? `Invitation sent to ${sentTo[0]}.` : `${sentTo.length} invitations sent: ${sentTo.join(', ')}.`}
        </p>
      )}
    </form>
  );
}

function OpenInvitations({ workspaceId }: { workspaceId: string }) {
  const invitations = useInvitations(workspaceId, true);
  const resend = useResendInvitation(workspaceId);
  const revoke = useRevokeInvitation(workspaceId);
  const toast = useToast();
  const confirm = useConfirm();

  const revokeFor = async (invitation: Invitation) => {
    const ok = await confirm({
      title: `Revoke the invitation for ${invitation.email}?`,
      message: 'Their invitation link stops working. You can invite them again later.',
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (ok) {
      revoke.mutate(invitation.id, { onSuccess: () => toast({ message: `Revoked the invitation for ${invitation.email}` }) });
    }
  };

  const resendTo = (invitation: Invitation) =>
    resend.mutate(invitation.id, { onSuccess: () => toast({ message: `Invitation sent again to ${invitation.email}`, tone: 'success' }) });

  if (!invitations.data?.length) {
    return <LoadError queries={invitations} />;
  }

  return (
    <section className="card stack" aria-labelledby="open-invitations-heading">
      <h2 id="open-invitations-heading">Pending invitations</h2>
      <ul className="team">
        {invitations.data.map((invitation) => (
          <li key={invitation.id}>
            <span>
              {invitation.email}
              <span className="muted small block">
                {invitation.role} · invited by {personLabel(invitation.invitedByName, invitation.invitedByEmail)} · until {formatDayOf(invitation.expiresAt)}
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
                onClick={() => void revokeFor(invitation)}
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
