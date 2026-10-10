import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { useAddMember, useMembers, useRemoveMember } from '../api/queries';
import type { Idea, Member } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';

export function TeamSection({ idea }: { idea: Idea }) {
  const members = useMembers(idea.id);
  const remove = useRemoveMember(idea.id);
  const { account } = useAuth();
  const navigate = useNavigate();
  const isOwner = idea.role === 'Owner';

  const removeMember = (member: Member) => {
    const leaving = member.email === account?.email;
    const question = leaving ? `Leave “${idea.title}”? You will lose access to it.` : `Remove ${member.email} from this idea?`;
    if (window.confirm(question)) {
      remove.mutate(member.userId, { onSuccess: () => (leaving ? void navigate('/') : undefined) });
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
            const canRemove = member.role === 'Member' && (isOwner || isMe);
            return (
              <li key={member.userId}>
                <span>
                  {member.email}
                  {isMe && <span className="muted"> (you)</span>}
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
      {isOwner ? <AddMemberForm ideaId={idea.id} /> : <p className="muted small">Only the owner can add or remove team members.</p>}
    </section>
  );
}

function AddMemberForm({ ideaId }: { ideaId: string }) {
  const add = useAddMember(ideaId);
  const [email, setEmail] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    add.mutate(email, { onSuccess: () => setEmail('') });
  };

  return (
    <form className="row wrap end" onSubmit={submit} aria-label="Add team member">
      <Field label="Add a teammate by email" error={fieldError(add.error, 'email')} className="grow">
        {(props) => (
          <input {...props} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        )}
      </Field>
      <button type="submit" className="button" disabled={add.isPending}>
        Add
      </button>
      <ErrorMessage error={add.error} />
    </form>
  );
}
