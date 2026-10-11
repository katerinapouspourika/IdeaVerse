import { useState, type FormEvent } from 'react';

import { useAddMember, useMembers, useRemoveMember, useWorkspaceMembers } from '../api/queries';
import { personLabel, type Idea, type Member } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

export function TeamSection({ idea }: { idea: Idea }) {
  const members = useMembers(idea.id);
  const remove = useRemoveMember(idea.id);
  const { account } = useAuth();

  const removeMember = (member: Member) => {
    const leaving = member.email === account?.email;
    const question = leaving
      ? `Leave the team of “${idea.title}”? You will still see it, but no longer get its reminders.`
      : `Remove ${personLabel(member.name, member.email)} from this idea’s team?`;
    if (window.confirm(question)) {
      remove.mutate(member.userId);
    }
  };

  return (
    <section className="card stack" aria-labelledby="team-heading">
      <h2 id="team-heading">Team</h2>
      {members.isLoading && <p className="muted">Loading…</p>}
      {members.data && (
        <ul className="team">
          {members.data.map((member) => {
            const isMe = member.email === account?.email;
            const canRemove = member.role === 'Member' && (idea.canManage || isMe);
            return (
              <li key={member.userId}>
                <span>
                  {personLabel(member.name, member.email)}
                  {isMe && <span className="muted"> (you)</span>}
                  {member.name && <span className="muted small block">{member.email}</span>}
                </span>
                <span className="row">
                  <span className="badge">{member.role}</span>
                  {canRemove && (
                    <button type="button" className="button ghost small" onClick={() => removeMember(member)}>
                      {isMe ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <ErrorMessage error={members.error ?? remove.error} />
      {idea.canManage ? (
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
      <ErrorMessage error={add.error ?? people.error} />
    </form>
  );
}
