import { Link } from 'react-router';

import { daysUntil, describeDue, formatDate } from '../api/dates';
import { useAssignments, useIdeas, useNotifications } from '../api/queries';
import type { Assignment, Idea, Workspace } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorMessage } from '../components/ErrorMessage';
import { StatusBadge } from '../components/StatusBadge';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { WelcomePage } from './WelcomePage';

/** How many items each dashboard list shows before linking to the full page. */
const listSize = 5;

/** The signed-in home page: what needs attention in the current workspace. */
export function DashboardPage() {
  const { current, isLoading, error } = useWorkspace();

  if (isLoading) {
    return <p className="muted">Loading…</p>;
  }

  if (!current) {
    return error ? <ErrorMessage error={error} /> : <WelcomePage />;
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

  return (
    <div className="stack dashboard">
      <section className="hero-card">
        <div className="stack tight">
          <p className="eyebrow">{workspace.name}</p>
          <h1>{greeting(new Date().getHours())}{name ? `, ${name}` : ''}</h1>
          <p className="hero-sub">{summary(overdue.length, dueThisWeek.length, assignments.data?.length ?? 0)}</p>
        </div>
        <div className="row wrap">
          <Link to="/ideas" state={{ adding: true }} className="button light">
            New idea
          </Link>
          <Link to="/ideas" className="button outline-light">
            All ideas
          </Link>
        </div>
      </section>

      <ErrorMessage error={ideas.error ?? assignments.error} />

      <section className="stats" aria-label="At a glance">
        <Stat label="Overdue" value={overdue.length} tone="danger" />
        <Stat label="Due this week" value={dueThisWeek.length} tone="warn" />
        <Stat label="In progress" value={open.filter((i) => i.status === 'InProgress').length} tone="accent" />
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
          {ideas.isLoading && <p className="muted">Loading…</p>}
          {ideas.data && attention.length === 0 && <p className="muted">Nothing overdue or due this week. Nice work! 🎉</p>}
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
          {assignments.isLoading && <p className="muted">Loading…</p>}
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
            <h2 id="reminders-heading">Latest reminders</h2>
            <Link to="/notifications" className="small">
              See all
            </Link>
          </div>
          {notifications.data?.items.length === 0 && <p className="muted">No reminders yet.</p>}
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
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warn' | 'accent' | 'ok' }) {
  return (
    <div className={`stat ${tone}`}>
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
