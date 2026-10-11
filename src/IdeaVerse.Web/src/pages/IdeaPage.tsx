import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { TagInput } from '../components/TagInput';
import { usePageMeta } from '../seo/usePageMeta';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { ActivitySection } from './ActivitySection';
import { ComponentsSection } from './ComponentsSection';
import { DiscussionSection } from './DiscussionSection';
import { TeamSection } from './TeamSection';

export function IdeaPage() {
  const { id = '' } = useParams();
  const idea = useIdea(id);
  usePageMeta(idea.data?.title ?? 'Idea', { index: false });

  if (idea.isLoading) {
    return <p className="muted">Loading idea…</p>;
  }

  if (idea.error instanceof ApiError && idea.error.status === 404) {
    return (
      <div className="card empty">
        <p>This idea doesn’t exist or isn’t in one of your workspaces.</p>
        <Link to="/ideas">Back to ideas</Link>
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
  const matchedIdea = useRef<string | null>(null);

  // Opening an idea from another workspace switches the header to it, once; switching away afterwards is the user's choice.
  useEffect(() => {
    if (matchedIdea.current === idea.id || !all.some((w) => w.id === ideaWorkspaceId)) {
      return;
    }
    matchedIdea.current = idea.id;
    if (current?.id !== ideaWorkspaceId) {
      select(ideaWorkspaceId);
    }
  }, [idea.id, ideaWorkspaceId, all, current, select]);

  return (
    <div className="stack">
      <Link to="/ideas" className="small">
        ← All ideas
      </Link>
      {idea.archivedAt && <ArchivedBanner idea={idea} />}

      {editing ? (
        <EditIdeaForm idea={idea} onDone={() => setEditing(false)} />
      ) : (
        <section className="card stack">
          <div className="row spread wrap idea-heading">
            <div className="row wrap">
              <h1>{idea.title}</h1>
              <StatusBadge idea={idea} />
            </div>
            {idea.canEdit && (
              <button type="button" className="button primary small" onClick={() => setEditing(true)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                Edit details
              </button>
            )}
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
            <ImproveIdea idea={idea} />
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
  const [tags, setTags] = useState(idea.tags);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ title, description: description || null, targetDate, status, tags }, { onSuccess: onDone });
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
      <Field label="Tags" hint="Type a tag and press Enter to add it." error={fieldError(update.error, 'tags')}>
        {(props) => <TagInput {...props} tags={tags} onChange={setTags} />}
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
      remove.mutate(undefined, { onSuccess: () => void navigate('/ideas') });
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
