import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ImproveIdea } from '../ai/ImproveIdea';
import { ApiError } from '../api/client';
import { addDays, describeDue, formatDate, todayIso } from '../api/dates';
import { useArchiveIdea, useDeleteIdea, useIdea, usePostponeIdea, useUpdateIdea } from '../api/queries';
import { personLabel, statuses, statusLabels, type Idea, type IdeaStatus } from '../api/types';
import { Field } from '../components/Field';
import { ErrorMessage, fieldError } from '../components/ErrorMessage';
import { Progress } from '../components/Progress';
import { StatusBadge } from '../components/StatusBadge';
import { Tags } from '../components/Tags';
import { formatTags, parseTags } from '../components/tagInput';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { ActivitySection } from './ActivitySection';
import { ComponentsSection } from './ComponentsSection';
import { DiscussionSection } from './DiscussionSection';
import { TeamSection } from './TeamSection';

export function IdeaPage() {
  const { id = '' } = useParams();
  const idea = useIdea(id);

  if (idea.isLoading) {
    return <p className="muted">Loading idea…</p>;
  }

  if (idea.error instanceof ApiError && idea.error.status === 404) {
    return (
      <div className="card empty">
        <p>This idea doesn’t exist or isn’t in one of your workspaces.</p>
        <Link to="/">Back to ideas</Link>
      </div>
    );
  }

  if (!idea.data) {
    return <ErrorMessage error={idea.error} />;
  }

  return <IdeaDetail idea={idea.data} />;
}

function IdeaDetail({ idea }: { idea: Idea }) {
  const [editing, setEditing] = useState(false);
  const { all, current, select } = useWorkspace();
  const ideaWorkspaceId = idea.workspaceId;
  const switchTo = current?.id !== ideaWorkspaceId && all.some((w) => w.id === ideaWorkspaceId) ? ideaWorkspaceId : null;

  useEffect(() => {
    if (switchTo) {
      select(switchTo);
    }
  }, [switchTo, select]);

  return (
    <div className="stack">
      <Link to="/" className="small">
        ← All ideas
      </Link>
      {idea.archivedAt && <ArchivedBanner idea={idea} />}

      {editing ? (
        <EditIdeaForm idea={idea} onDone={() => setEditing(false)} />
      ) : (
        <section className="card stack">
          <div className="row spread wrap">
            <h1>{idea.title}</h1>
            <StatusBadge idea={idea} />
          </div>
          <p>
            Implement by <strong>{formatDate(idea.targetDate)}</strong>{' '}
            <span className={idea.isOverdue ? 'overdue-text' : 'muted'}>({describeDue(idea.targetDate)})</span>
            {idea.postponeCount > 0 && <span className="muted"> · postponed {idea.postponeCount}×</span>}
          </p>
          <Tags tags={idea.tags} />
          {idea.description && <p className="description">{idea.description}</p>}
          <Progress done={idea.completedComponentCount} total={idea.componentCount} />
          {idea.canEdit ? (
            <>
              <div className="row">
                <button type="button" className="button" onClick={() => setEditing(true)}>
                  Edit details
                </button>
              </div>
              <ImproveIdea idea={idea} />
            </>
          ) : (
            <p className="muted small">
              {personLabel(idea.ownerName, idea.ownerEmail)}’s idea. You can follow it here; only its team and the workspace’s admins can change it.
            </p>
          )}
        </section>
      )}

      {idea.canEdit && idea.status !== 'Done' && !idea.archivedAt && <PostponeForm idea={idea} />}
      <ComponentsSection ideaId={idea.id} workspaceId={idea.workspaceId} canEdit={idea.canEdit} />
      <TeamSection idea={idea} />
      <DiscussionSection ideaId={idea.id} />
      <ActivitySection ideaId={idea.id} />
      {idea.canManage && !idea.archivedAt && <ArchiveIdea idea={idea} />}
      {idea.canManage && <DeleteIdea idea={idea} />}
    </div>
  );
}

function EditIdeaForm({ idea, onDone }: { idea: Idea; onDone: () => void }) {
  const update = useUpdateIdea(idea.id);
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description ?? '');
  const [targetDate, setTargetDate] = useState(idea.targetDate);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [tags, setTags] = useState(formatTags(idea.tags));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ title, description: description || null, targetDate, status, tags: parseTags(tags) }, { onSuccess: onDone });
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Edit idea">
      <h2>Edit idea</h2>
      <Field label="Title" error={fieldError(update.error, 'title')}>
        {(props) => (
          <input {...props} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        )}
      </Field>
      <div className="row wrap">
        <Field label="Implement by" error={fieldError(update.error, 'targetDate')}>
          {(props) => (
            <input {...props} type="date" required value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          )}
        </Field>
        <Field label="Status">
          {(props) => (
            <select {...props} value={status} onChange={(e) => setStatus(e.target.value as IdeaStatus)}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Description">
        {(props) => (
          <textarea {...props} rows={4} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <Field label="Tags" hint="Separate tags with commas." error={fieldError(update.error, 'tags')}>
        {(props) => <input {...props} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. marketing, q4" />}
      </Field>
      <ErrorMessage error={update.error} />
      <div className="row">
        <button type="submit" className="button primary" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="button ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PostponeForm({ idea }: { idea: Idea }) {
  const postpone = usePostponeIdea(idea.id);
  const today = todayIso();
  const earliest = idea.targetDate >= today ? addDays(idea.targetDate, 1) : today;
  const [targetDate, setTargetDate] = useState(addDays(earliest, 6));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    postpone.mutate(targetDate);
  };

  return (
    <form className="card stack" onSubmit={submit} aria-label="Postpone idea">
      <h2>Not the right time?</h2>
      <p className="muted small">Move it to a later date instead of letting it slip. It stays on your list.</p>
      <div className="row wrap end">
        <Field label="New date" error={fieldError(postpone.error, 'targetDate')}>
          {(props) => (
            <input {...props} type="date" required min={earliest} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          )}
        </Field>
        <button type="submit" className="button" disabled={postpone.isPending}>
          {postpone.isPending ? 'Postponing…' : 'Postpone'}
        </button>
      </div>
      <ErrorMessage error={postpone.error} />
    </form>
  );
}

function ArchivedBanner({ idea }: { idea: Idea }) {
  const restore = useArchiveIdea(idea.id);

  return (
    <div className="archived-banner stack" role="status">
      <div className="row spread wrap">
        <span>This idea is archived. It’s hidden from the list and sends no reminders.</span>
        {idea.canManage && (
          <button type="button" className="button small" onClick={() => restore.mutate(false)} disabled={restore.isPending}>
            Restore
          </button>
        )}
      </div>
      <ErrorMessage error={restore.error} />
    </div>
  );
}

function ArchiveIdea({ idea }: { idea: Idea }) {
  const archive = useArchiveIdea(idea.id);

  return (
    <section className="card stack">
      <h2>Archive idea</h2>
      <p className="muted small">Set it aside without losing anything. It leaves the list, stops sending reminders, and can be restored any time.</p>
      <ErrorMessage error={archive.error} />
      <div className="row">
        <button type="button" className="button" onClick={() => archive.mutate(true)} disabled={archive.isPending}>
          Archive idea
        </button>
      </div>
    </section>
  );
}

function DeleteIdea({ idea }: { idea: Idea }) {
  const remove = useDeleteIdea(idea.id);
  const navigate = useNavigate();

  const confirmAndDelete = () => {
    if (window.confirm(`Delete “${idea.title}”? This removes its components and team, and cannot be undone.`)) {
      remove.mutate(undefined, { onSuccess: () => void navigate('/') });
    }
  };

  return (
    <section className="card danger stack">
      <h2>Delete idea</h2>
      <p className="muted small">Only the idea’s owner and the workspace’s admins can delete it.</p>
      <ErrorMessage error={remove.error} />
      <div className="row">
        <button type="button" className="button danger" onClick={confirmAndDelete} disabled={remove.isPending}>
          Delete idea
        </button>
      </div>
    </section>
  );
}
