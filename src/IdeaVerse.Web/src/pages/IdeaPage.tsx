import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, CalendarClock, Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ImproveIdea } from '../ai/ImproveIdea';
import { useRecentIdea } from '../commands/recentIdeas';
import { ApiError } from '../api/client';
import { addDays, describeDue, formatDate, formatStart, todayIso } from '../api/dates';
import { useArchiveIdea, useDeleteIdea, useIdea, useMoveIdea, usePostponeIdea, useSetStart, useUpdateIdea } from '../api/queries';
import { canChange, personLabel, statuses, statusLabels, type Idea, type IdeaStatus } from '../api/types';
import { useConfirm, useToast } from '../components/Feedback';
import { Field } from '../components/Field';
import { Menu } from '../components/Menu';
import { ErrorMessage, LoadError, fieldError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { Tags } from '../components/Tags';
import { TagInput } from '../components/TagInput';
import { PriorityCard } from '../priority/PriorityCard';
import { VoteButton } from '../priority/VoteButton';
import { usePageMeta } from '../seo/usePageMeta';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { ActivitySection } from './ActivitySection';
import { ComponentsSection } from './ComponentsSection';
import { DiscussionSection } from './DiscussionSection';
import { TeamSection } from './TeamSection';

export function IdeaPage() {
  const { id = '' } = useParams();
  const idea = useIdea(id);
  useRecentIdea(id, idea.data, idea.error instanceof ApiError && idea.error.status === 404);
  usePageMeta(idea.data?.title ?? 'Idea', { index: false });

  if (idea.isLoading) {
    return <Skeleton variant="page" lines={5} />;
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
    return <LoadError queries={idea} />;
  }

  return <IdeaDetail idea={idea.data} />;
}

function IdeaDetail({ idea }: { idea: Idea }) {
  const [editing, setEditing] = useState(false);
  const { all, current, select } = useWorkspace();
  const changeable = canChange(idea);
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
      <nav aria-label="Breadcrumb" className="breadcrumb small">
        <Link to="/ideas">
          <ArrowLeft aria-hidden="true" size={16} /> All ideas
        </Link>
      </nav>
      {idea.archivedAt && <ArchivedBanner idea={idea} />}

      <div className="idea-layout">
        <div className="stack idea-main">
          {editing && changeable ? (
            <EditIdeaForm idea={idea} onDone={() => setEditing(false)} />
          ) : (
            <section className="card stack">
              <div className="row spread wrap idea-heading">
                <div className="row wrap">
                  <h1>{idea.title}</h1>
                  {changeable ? <QuickStatus idea={idea} /> : <StatusBadge idea={idea} />}
                  <VoteButton idea={idea} />
                </div>
                <div className="row">
                  {changeable && (
                    <button type="button" className="button primary small" onClick={() => setEditing(true)}>
                      <Pencil aria-hidden="true" size={16} />
                      Edit details
                    </button>
                  )}
                  {idea.canManage && <IdeaActions idea={idea} />}
                </div>
              </div>
              <p className="small">
                Target date <strong>{formatDate(idea.targetDate)}</strong>{' '}
                <span className={idea.isOverdue ? 'overdue-text' : 'muted'}>({describeDue(idea.targetDate)})</span>
              </p>
              {idea.startDate && (
                <p className="small">
                  Starts <strong>{formatStart(idea)}</strong>
                </p>
              )}
              <Tags tags={idea.tags} />
              {idea.description ? <p className="description">{idea.description}</p> : <p className="muted">No description yet.</p>}
              {changeable ? (
                <ImproveIdea idea={idea} />
              ) : idea.archivedAt ? null : (
                <p className="muted small">
                  {personLabel(idea.ownerName, idea.ownerEmail)}’s idea. You can follow it here; only its team and the workspace’s admins can change it.
                </p>
              )}
            </section>
          )}
        </div>

        {/* In reading order, which is also the phone layout: the work comes before the details and the activity last. */}
        <div className="stack idea-work">
          <ComponentsSection ideaId={idea.id} workspaceId={idea.workspaceId} canEdit={changeable} />
          <DiscussionSection ideaId={idea.id} workspaceId={idea.workspaceId} />
        </div>

        <aside className="stack idea-side" aria-label="Idea details">
          <ScheduleCard idea={idea} />
          <PriorityCard idea={idea} />
          <TeamSection idea={idea} />
        </aside>

        <div className="stack idea-activity">
          <ActivitySection ideaId={idea.id} />
        </div>
      </div>
    </div>
  );
}

/** The idea's status as a menu its team can change straight from the heading. */
function QuickStatus({ idea }: { idea: Idea }) {
  const move = useMoveIdea();
  const toast = useToast();
  const status = move.isPending ? move.variables.status : idea.status;

  const change = (next: IdeaStatus) =>
    move.mutate(
      { idea, status: next },
      {
        onSuccess: () => toast({ message: `Status set to ${statusLabels[next]}` }),
        onError: () => toast({ message: 'Couldn’t change the status. Try again.', tone: 'error' }),
      },
    );

  return (
    <span className="badges">
      <label className="quick-status">
        <span className="visually-hidden">Status</span>
        <select className={`badge status-${status.toLowerCase()}`} value={status} onChange={(e) => change(e.target.value as IdeaStatus)}>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      {idea.isOverdue && <span className="badge overdue">Overdue</span>}
    </span>
  );
}

/** When the idea is due, who owns it, and, for its team, a quick way to postpone it. */
function ScheduleCard({ idea }: { idea: Idea }) {
  const canPostpone = canChange(idea) && idea.status !== 'Done';
  const start = formatStart(idea);
  return (
    <section className="card stack" aria-labelledby="schedule-heading">
      <h2 id="schedule-heading">Schedule</h2>
      <dl className="facts">
        {start && (
          <>
            <dt>Starts</dt>
            <dd>
              <strong>{start}</strong>
            </dd>
          </>
        )}
        <dt>Target date</dt>
        <dd>
          <strong>{formatDate(idea.targetDate)}</strong>{' '}
          <span className={idea.isOverdue ? 'overdue-text small' : 'muted small'}>({describeDue(idea.targetDate)})</span>
        </dd>
        {idea.postponeCount > 0 && (
          <>
            <dt>Postponed</dt>
            <dd>{idea.postponeCount === 1 ? 'Once' : `${idea.postponeCount} times`}</dd>
          </>
        )}
        <dt>Owner</dt>
        <dd>{personLabel(idea.ownerName, idea.ownerEmail)}</dd>
        <dt>Created</dt>
        <dd>{formatDate(idea.createdAt.slice(0, 10))}</dd>
      </dl>
      {canPostpone && <StartForm idea={idea} />}
      {canPostpone && <PostponeForm idea={idea} />}
    </section>
  );
}

/** The idea's less frequent actions, for its owner and the workspace's admins: archive or restore, and delete. */
function IdeaActions({ idea }: { idea: Idea }) {
  const archive = useArchiveIdea(idea.id);
  const remove = useDeleteIdea(idea.id);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();

  const setArchived = (archived: boolean) =>
    archive.mutate(archived, {
      onSuccess: () => toast({ message: archived ? 'Idea archived' : 'Idea restored', undo: () => archive.mutate(!archived) }),
      onError: (error) => toast({ message: error.message, tone: 'error' }),
    });

  const deleteIdea = async () => {
    const ok = await confirm({
      title: `Delete “${idea.title}”?`,
      message: 'This removes its components, team, and discussion, and cannot be undone. Archive it instead to keep it out of the way.',
      confirmLabel: 'Delete idea',
      danger: true,
    });
    if (ok) {
      remove.mutate(undefined, {
        onSuccess: () => {
          toast({ message: `Deleted “${idea.title}”` });
          void navigate('/ideas');
        },
        onError: (error) => toast({ message: error.message, tone: 'error' }),
      });
    }
  };

  return (
    <Menu
      label="More actions"
      trigger={<Ellipsis aria-hidden="true" size={20} />}
      items={[
        idea.archivedAt
          ? { label: 'Restore idea', icon: <ArchiveRestore aria-hidden="true" size={16} />, onSelect: () => setArchived(false) }
          : { label: 'Archive idea', icon: <Archive aria-hidden="true" size={16} />, onSelect: () => setArchived(true) },
        { label: 'Delete idea', icon: <Trash2 aria-hidden="true" size={16} />, onSelect: () => void deleteIdea(), danger: true },
      ]}
    />
  );
}

function EditIdeaForm({ idea, onDone }: { idea: Idea; onDone: () => void }) {
  const update = useUpdateIdea(idea.id);
  const toast = useToast();
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description ?? '');
  const [targetDate, setTargetDate] = useState(idea.targetDate);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [tags, setTags] = useState(idea.tags);
  // Not in the past, unless the idea is already overdue and keeps its date, and not before the planned start.
  const today = todayIso();
  const floor = idea.targetDate < today ? idea.targetDate : today;
  const earliest = idea.startDate && idea.startDate > floor ? idea.startDate : floor;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      { title, description: description || null, targetDate, status, tags },
      {
        onSuccess: () => {
          toast({ message: 'Changes saved' });
          onDone();
        },
      },
    );
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
        <Field label="Target date" error={fieldError(update.error, 'targetDate')}>
          {(props) => (
            <input {...props} type="date" required min={earliest} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
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

/** Plans when work on the idea starts: a date, and optionally a time; the team is reminded ahead of it. */
function StartForm({ idea }: { idea: Idea }) {
  const setStart = useSetStart(idea.id);
  const toast = useToast();
  const today = todayIso();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(idea.startDate ?? (today <= idea.targetDate ? today : idea.targetDate));
  const [startTime, setStartTime] = useState(idea.startTime?.slice(0, 5) ?? '');

  const save = (event: FormEvent) => {
    event.preventDefault();
    setStart.mutate(
      { startDate, startTime: startTime || null },
      {
        onSuccess: (saved) => {
          setOpen(false);
          toast({ message: `Starts ${formatStart(saved) ?? ''}` });
        },
      },
    );
  };

  const clear = () =>
    setStart.mutate({ startDate: null, startTime: null }, { onSuccess: () => toast({ message: 'Start cleared' }) });

  if (!open) {
    return (
      <div className="row wrap">
        <button type="button" className="button small" onClick={() => setOpen(true)}>
          <CalendarClock aria-hidden="true" size={16} />
          {idea.startDate ? 'Change start' : 'Plan the start'}
        </button>
        {idea.startDate && (
          <button type="button" className="button ghost small" onClick={clear} disabled={setStart.isPending}>
            Clear start
          </button>
        )}
        <ErrorMessage error={setStart.error} />
      </div>
    );
  }

  return (
    <form className="stack tight" onSubmit={save} aria-label="Plan the start">
      <p className="muted small">The team is reminded before it starts, from 10 days ahead.</p>
      <div className="row wrap">
        <Field label="Start date" error={fieldError(setStart.error, 'startDate')}>
          {(props) => (
            <input {...props} type="date" required min={today} max={idea.targetDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          )}
        </Field>
        <Field label=<>Time <span className="muted">(optional)</span></> error={fieldError(setStart.error, 'startTime')}>
          {(props) => <input {...props} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
        </Field>
      </div>
      <div className="row">
        <button type="submit" className="button primary small" disabled={setStart.isPending}>
          {setStart.isPending ? 'Saving…' : 'Save start'}
        </button>
        <button type="button" className="button ghost small" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <ErrorMessage error={setStart.error} />
    </form>
  );
}

function PostponeForm({ idea }: { idea: Idea }) {
  const postpone = usePostponeIdea(idea.id);
  const toast = useToast();
  const today = todayIso();
  const earliest = idea.targetDate >= today ? addDays(idea.targetDate, 1) : today;
  const [targetDate, setTargetDate] = useState(addDays(earliest, 6));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    postpone.mutate(targetDate, { onSuccess: () => toast({ message: `Postponed to ${formatDate(targetDate)}` }) });
  };

  return (
    <form className="stack tight postpone-form" onSubmit={submit} aria-label="Postpone idea">
      <Field label="Not the right time? Move it to" error={fieldError(postpone.error, 'targetDate')}>
        {(props) => (
          <input {...props} type="date" required min={earliest} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        )}
      </Field>
      <button type="submit" className="button small" disabled={postpone.isPending}>
        <CalendarClock aria-hidden="true" size={16} />
        {postpone.isPending ? 'Postponing…' : 'Postpone'}
      </button>
      <ErrorMessage error={postpone.error} />
    </form>
  );
}

function ArchivedBanner({ idea }: { idea: Idea }) {
  const restore = useArchiveIdea(idea.id);
  const toast = useToast();

  return (
    <div className="archived-banner stack" role="status">
      <div className="row spread wrap">
        <span>
          This idea is archived and read-only: it’s hidden from the list and sends no reminders, but you can still discuss it and vote for it.{' '}
          {idea.canManage ? 'Restore it to make changes.' : 'Its owner or a workspace admin can restore it.'}
        </span>
        {idea.canManage && (
          <button type="button" className="button small" onClick={() => restore.mutate(false, { onSuccess: () => toast({ message: 'Idea restored' }) })} disabled={restore.isPending}>
            Restore
          </button>
        )}
      </div>
      <ErrorMessage error={restore.error} />
    </div>
  );
}
