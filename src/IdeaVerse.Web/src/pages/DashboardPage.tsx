import { Lightbulb, PartyPopper } from 'lucide-react';
import { Link } from 'react-router';

import { daysUntil, describeDue, formatDate } from '../api/dates';
import { useAssignments, useIdeas, useNotifications } from '../api/queries';
import type { Assignment, Idea, Workspace } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { LoadError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';
import { StatusBadge } from '../components/StatusBadge';
import { usePageMeta } from '../seo/usePageMeta';
import { StarterTemplates } from '../templates/StarterTemplates';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { GettingStarted } from './GettingStarted';
import { WelcomePage } from './WelcomePage';

/** How many items each dashboard list shows before linking to the full page. */
const listSize = 5;

/** The signed-in home page: what needs attention in the current workspace. */
export function DashboardPage() {
  usePageMeta('Home', { index: false });
  const workspaces = useWorkspace();
  const { current, isLoading, error } = workspaces;

  if (isLoading) {
    return <Skeleton variant="page" lines={4} />;
  }

  if (!current) {
    return error ? <LoadError queries={workspaces} /> : <WelcomePage />;
  }

  return <WorkspaceDashboard key={current.id} workspace={current} />;
}

function WorkspaceDashboard({ workspace }: { workspace: Workspace }) {
  const { account } = useAuth();
  const ideas = useIdeas(workspace.id);
  const assignments = useAssignments(workspace.id);
  const notifications = useNotifications();
  const name = account?.displayName?.trim().split(/\s+/)[0];

  const open = (ideas.data ?? []).filter((i) => i.status !== 'Done');
  const overdue = open.filter((i) => i.isOverdue);
  const dueThisWeek = open.filter((i) => !i.isOverdue && daysUntil(i.targetDate) <= 7);
  const attention = [...overdue, ...dueThisWeek].slice(0, listSize);
  // A new workspace has nothing to count or catch up on yet, so it gets one way to add its first idea instead.
  const empty = ideas.data?.length === 0;

  return (
    <div className="stack dashboard">
      <section className="hero-card">
        <div className="stack tight">
          <p className="eyebrow">{workspace.name}</p>
          <h1>{greeting(new Date().getHours())}{name ? `, ${name}` : ''}</h1>
          <p className="hero-sub">
            {empty
              ? 'Your workspace is ready. Add your first idea to get going.'
              : ideas.data && summary(overdue.length, dueThisWeek.length, assignments.data?.length ?? 0)}
          </p>
        </div>
        {!empty && (
          <div className="row wrap">
            <Link to="/ideas" state={{ adding: true }} className="button light">
              New idea
            </Link>
            <Link to="/ideas" className="button outline-light">
              All ideas
            </Link>
          </div>
        )}
      </section>

      <LoadError queries={[ideas, assignments]} />

      {account && ideas.data && <GettingStarted workspace={workspace} ideas={ideas.data} account={account} />}

      {empty ? (
        <section className="card stack center" aria-labelledby="first-idea-heading">
          <span className="feature-icon big" aria-hidden="true">
            <Lightbulb size={32} />
          </span>
          <h2 id="first-idea-heading">Add your first idea</h2>
          <p className="muted">Give it a date to make it real by, or start from a template with its checklist ready.</p>
          <div className="row wrap center-row">
            <Link to="/ideas" state={{ adding: true }} className="button primary">
              Add a blank idea
            </Link>
            <StarterTemplates />
          </div>
        </section>
      ) : (
        <>
          <section className="stats" aria-label="At a glance">
            <Stat label="Active ideas" value={open.length} tone="accent" />
            <Stat label="Overdue" value={overdue.length} tone="danger" />
            <Stat label="Due this week" value={dueThisWeek.length} tone="warn" />
            <Stat label="Done" value={(ideas.data ?? []).length - open.length} tone="ok" />
          </section>

          <div className="dashboard-grid">
            <section className="card stack" aria-labelledby="attention-heading">
              <div className="row spread">
                <h2 id="attention-heading">Needs attention</h2>
                <Link to="/ideas" className="small">
                  See all
                </Link>
              </div>
              {ideas.isLoading && <Skeleton />}
              {ideas.data && attention.length === 0 && <p className="muted row">
                  <PartyPopper aria-hidden="true" size={18} /> Nothing overdue or due this week. Nice work!
                </p>}
              {attention.length > 0 && (
                <ul className="mini-list">
                  {attention.map((idea) => (
                    <AttentionItem key={idea.id} idea={idea} />
                  ))}
                </ul>
              )}
            </section>

            <section className="card stack" aria-labelledby="tasks-heading">
              <h2 id="tasks-heading">Your tasks</h2>
              {assignments.isLoading && <Skeleton />}
              {assignments.data?.length === 0 && <p className="muted">Nothing assigned to you right now.</p>}
              {assignments.data && assignments.data.length > 0 && (
                <ul className="mini-list">
                  {assignments.data.slice(0, listSize).map((assignment) => (
                    <TaskItem key={assignment.componentId} assignment={assignment} />
                  ))}
                </ul>
              )}
              {assignments.data && assignments.data.length > listSize && (
                <p className="muted small">and {assignments.data.length - listSize} more</p>
              )}
            </section>

            <section className="card stack" aria-labelledby="reminders-heading">
              <div className="row spread">
                <h2 id="reminders-heading">Latest notifications</h2>
                <Link to="/notifications" className="small">
                  See all
                </Link>
              </div>
              {notifications.data?.items.length === 0 && <p className="muted">No notifications yet.</p>}
              {notifications.data && notifications.data.items.length > 0 && (
                <ul className="mini-list">
                  {notifications.data.items.slice(0, listSize).map((n) => (
                    <li key={n.id} className={n.readAt ? undefined : 'unread'}>
                      <Link to={`/ideas/${n.ideaId}`}>{n.message}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warn' | 'accent' | 'ok' }) {
  return (
    // A zero is not news, so it stays in the plain text colour.
    <div className={value > 0 ? `stat ${tone}` : 'stat'}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function AttentionItem({ idea }: { idea: Idea }) {
  return (
    <li>
      <Link to={`/ideas/${idea.id}`} className="mini-item">
        <span className="mini-title">{idea.title}</span>
        <span className="row small">
          <span className={idea.isOverdue ? 'overdue-text' : 'muted'}>{describeDue(idea.targetDate)}</span>
          <StatusBadge idea={idea} />
        </span>
      </Link>
    </li>
  );
}

function TaskItem({ assignment }: { assignment: Assignment }) {
  const overdue = assignment.dueDate !== null && daysUntil(assignment.dueDate) < 0;
  return (
    <li>
      <Link to={`/ideas/${assignment.ideaId}`} className="mini-item">
        <span className="mini-title">{assignment.title}</span>
        <span className="small muted">
          for {assignment.ideaTitle}
          {assignment.dueDate && (
            <>
              {' · '}
              <span className={overdue ? 'overdue-text' : undefined} title={formatDate(assignment.dueDate)}>
                due {describeDue(assignment.dueDate)}
              </span>
            </>
          )}
        </span>
      </Link>
    </li>
  );
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function summary(overdue: number, dueThisWeek: number, tasks: number): string {
  if (overdue === 0 && dueThisWeek === 0 && tasks === 0) {
    return 'You’re all caught up. Time to capture a new idea?';
  }
  const parts = [
    overdue > 0 && `${overdue} overdue`,
    dueThisWeek > 0 && `${dueThisWeek} due this week`,
    tasks > 0 && `${tasks} ${tasks === 1 ? 'task' : 'tasks'} for you`,
  ].filter(Boolean);
  return `Here’s your day: ${parts.join(', ')}.`;
}
