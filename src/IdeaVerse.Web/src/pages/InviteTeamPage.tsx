import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';

import { ApiError } from '../api/client';
import { useInvite } from '../api/queries';
import type { WorkspaceRole } from '../api/types';
import { useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { usePageMeta } from '../seo/usePageMeta';
import { pendingTemplate } from '../templates/pendingTemplate';
import { SetupSteps } from '../workspaces/SetupSteps';
import { canManageWorkspace, useWorkspace } from '../workspaces/WorkspaceContext';

/** How many address boxes the form starts with. */
const startingRows = 3;

/** The most people the form invites at once. */
const maxRows = 10;

/** One address box and, after sending, why that address was not invited. */
interface Row {
  id: number;
  email: string;
  error?: string;
}

/** Why the API refused one invitation, in words for the person sending it. */
function reasonFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.fieldError('email') ?? error.fieldError('role') ?? error.message;
  }
  return 'This invitation couldn’t be sent. Try again.';
}

/**
 * The second step of setting up a workspace: invite teammates by email, or skip for now. Each address is invited on its
 * own, so one refused address keeps its box with the reason while the rest are sent.
 */
export function InviteTeamPage() {
  usePageMeta('Invite your team', { index: false });
  const { id } = useParams();
  const { all, isLoading } = useWorkspace();
  const workspace = all.find((w) => w.id === id);
  const invite = useInvite(id ?? '');
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: startingRows }, (_, i) => ({ id: i, email: '' })));
  const [role, setRole] = useState<Extract<WorkspaceRole, 'Admin' | 'Member'>>('Member');
  const [sending, setSending] = useState(false);

  if (isLoading) {
    return null;
  }
  if (!workspace || !canManageWorkspace(workspace)) {
    return <Navigate to="/ideas" replace />;
  }

  const update = (rowId: number, email: string) => setRows((all) => all.map((r) => (r.id === rowId ? { id: r.id, email } : r)));
  const remove = (rowId: number) => setRows((all) => all.filter((r) => r.id !== rowId));
  const add = () => setRows((all) => [...all, { id: Math.max(-1, ...all.map((r) => r.id)) + 1, email: '' }]);

  // Home holds the Get started checklist; a template chosen before signing up opens its form on the ideas page instead.
  const finish = () => void navigate(pendingTemplate() ? '/ideas' : '/');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const filled = rows.filter((r) => r.email.trim() !== '');
    if (filled.length === 0) {
      finish();
      return;
    }
    setSending(true);
    const failed: Row[] = [];
    for (const row of filled) {
      try {
        await invite.mutateAsync({ email: row.email.trim(), role });
      } catch (error) {
        failed.push({ ...row, error: reasonFor(error) });
      }
    }
    setSending(false);
    const sent = filled.length - failed.length;
    if (sent > 0) {
      toast({ message: sent === 1 ? 'Invitation sent' : `${sent} invitations sent`, tone: 'success' });
    }
    if (failed.length === 0) {
      finish();
      return;
    }
    setRows(failed);
  };

  return (
    <div className="stack setup">
      <SetupSteps current={2} />
      <h1>Invite your team to {workspace.name}</h1>
      <p className="muted">
        Everyone you invite gets an email with a link to join. People without an account can sign up with the same address and find the invitation waiting.
      </p>
      <form className="card stack" onSubmit={(event) => void submit(event)} aria-label="Invite your team">
        {rows.map((row, i) => (
          <div key={row.id} className="row end invite-row">
            <Field label={`Email ${i + 1}`} error={row.error} className="grow">
              {(props) => (
                <input
                  {...props}
                  type="email"
                  autoComplete="off"
                  placeholder="name@company.com"
                  value={row.email}
                  onChange={(e) => update(row.id, e.target.value)}
                />
              )}
            </Field>
            {rows.length > 1 && (
              <button type="button" className="button ghost small icon-button" aria-label={`Remove address ${i + 1}`} onClick={() => remove(row.id)}>
                <X aria-hidden="true" size={16} />
              </button>
            )}
          </div>
        ))}
        {rows.length < maxRows && (
          <div>
            <button type="button" className="button ghost small" onClick={add}>
              <Plus aria-hidden="true" size={16} /> Add another
            </button>
          </div>
        )}
        <Field label="Invite them as" hint="Admins can invite people and manage the workspace too.">
          {(props) => (
            <select {...props} value={role} onChange={(e) => setRole(e.target.value as 'Admin' | 'Member')}>
              <option value="Member">Members</option>
              <option value="Admin">Admins</option>
            </select>
          )}
        </Field>
        <div className="row wrap">
          <button type="submit" className="button primary" disabled={sending}>
            {sending ? 'Sending…' : 'Send invitations'}
          </button>
          <button type="button" className="button ghost" onClick={finish} disabled={sending}>
            Skip for now
          </button>
        </div>
      </form>
      <p className="muted small">
        You can invite people any time from <Link to="/people">People</Link>.
      </p>
    </div>
  );
}
