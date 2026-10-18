import { useState, type FormEvent } from 'react';

import { useAddMember, useMembers, useRemoveMember, useWorkspaceMembers } from '../api/queries';
import { personLabel, type Idea, type Member } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useConfirm, useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { Person } from '../components/Person';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';

export function TeamSection({ idea }: { idea: Idea }) {
  const members = useMembers(idea.id);
  const remove = useRemoveMember(idea.id);
  const { account } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  // An archived idea's team stays as it is until the idea is restored.
  const archived = Boolean(idea.archivedAt);

  const removeMember = async (member: Member) => {
    const leaving = member.email === account?.email;
    const name = personLabel(member.name, member.email);
    const ok = await confirm(
      leaving
        ? { title: 'Leave this team?', message: `You will still see “${idea.title}”, but no longer get its reminders.`, confirmLabel: 'Leave team', danger: true }
        : { title: `Remove ${name} from the team?`, message: `They will still see “${idea.title}”, but no longer change it.`, confirmLabel: 'Remove', danger: true },
    );
    if (ok) {
      remove.mutate(member.userId, { onSuccess: () => toast({ message: leaving ? 'You left the team' : `Removed ${name} from the team` }) });
    }
  };

  return (
    <section className="card stack" aria-labelledby="team-heading">
      <h2 id="team-heading">Team</h2>
      {members.isLoading && <Skeleton lines={2} />}
      {members.data && (
        <ul className="team">
          {members.data.map((member) => {
            const isMe = member.email === account?.email;
            const canRemove = !archived && member.role === 'Member' && (idea.canManage || isMe);
            return (
              <li key={member.userId}>
                <Person name={member.name} email={member.email} after={isMe && <span className="muted"> (you)</span>} />
                <span className="row">
                  <span className="badge">{member.role}</span>
                  {canRemove && (
                    <button type="button" className="button ghost small" onClick={() => void removeMember(member)}>
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
      <ErrorMessage error={remove.error} />
      {archived ? (
        <p className="muted small">The team can’t change while the idea is archived.</p>
      ) : idea.canManage ? (
        <AddMemberForm idea={idea} team={members.data ?? []} />
      ) : (
        <p className="muted small">Only the idea’s owner and the workspace’s admins can add or remove team members.</p>
      )}
    </section>
  );
}

/** Adds someone from the idea's workspace who is not on the team yet. */
function AddMemberForm({ idea, team }: { idea: Idea; team: Member[] }) {
  const add = useAddMember(idea.id);
  const people = useWorkspaceMembers(idea.workspaceId);
  const [email, setEmail] = useState('');
  const candidates = (people.data ?? []).filter((person) => !team.some((member) => member.userId === person.userId));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(email, { onSuccess: () => setEmail('') });
  };

  if (people.data && candidates.length === 0) {
    return <p className="muted small">Everyone in the workspace is on this team. Invite more people from the People page.</p>;
  }

  return (
    <form className="row wrap end" onSubmit={submit} aria-label="Add team member">
      <Field label="Add someone from the workspace" error={fieldError(add.error, 'email')} className="grow">
        {(props) => (
          <select {...props} required value={email} onChange={(e) => setEmail(e.target.value)}>
            <option value="">Choose a person…</option>
            {candidates.map((person) => (
              <option key={person.userId} value={person.email}>
                {person.name ? `${person.name} (${person.email})` : person.email}
              </option>
            ))}
          </select>
        )}
      </Field>
      <button type="submit" className="button" disabled={add.isPending || !email}>
        Add
      </button>
      <ErrorMessage error={add.error} />
      <LoadError queries={people} />
    </form>
  );
}
