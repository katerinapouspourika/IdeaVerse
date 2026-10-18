import { useId } from 'react';
import { Link, useSearchParams } from 'react-router';

import { formatMoment, todayIso } from '../api/dates';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../api/queries';
import { notificationLink, type Notification, type ReminderKind } from '../api/types';
import { ErrorMessage, LoadError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';
import { usePageMeta } from '../seo/usePageMeta';
import { WorkspaceTag } from '../workspaces/WorkspaceTag';

const kindLabels: Record<ReminderKind, string> = {
  ComingUp: 'Coming up',
  Tomorrow: 'Tomorrow',
  Today: 'Today',
  Overdue: 'Overdue',
  Assigned: 'Assigned to you',
  AddedToTeam: 'Added to team',
  Commented: 'Comment',
  Mentioned: 'Mention',
  StartingSoon: 'Starting soon',
  AddComponents: 'Add components',
};

/** Which notifications the page shows, kept in the address as `?show=` so Back returns to the same view. */
type Filter = 'all' | 'unread' | 'mentions';

const filters: { value: Filter; label: string; matches: (n: Notification) => boolean; empty: string }[] = [
  { value: 'all', label: 'All', matches: () => true, empty: '' },
  { value: 'unread', label: 'Unread', matches: (n) => n.readAt === null, empty: 'You’re all caught up. Nothing unread.' },
  { value: 'mentions', label: 'Mentions', matches: (n) => n.kind === 'Mentioned', empty: 'No mentions yet. When someone @mentions you in a comment, it shows up here.' },
];

export function NotificationsPage() {
  usePageMeta('Notifications', { index: false });
  const notifications = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.data?.unreadCount ?? 0;
  const [params, setParams] = useSearchParams();
  const filter = filters.find((f) => f.value === params.get('show')) ?? filters[0]!;
  const shown = notifications.data?.items.filter(filter.matches) ?? [];
  // "Today" is the account's local date, never the UTC one.
  const today = todayIso();
  const todays = shown.filter((n) => todayIso(new Date(n.createdAt)) === today);
  const earlier = shown.filter((n) => todayIso(new Date(n.createdAt)) !== today);

  const choose = (value: Filter) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === 'all') next.delete('show');
        else next.set('show', value);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="stack">
      <div className="row spread wrap">
        <h1>Notifications</h1>
        {unread > 0 && (
          <button type="button" className="button" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            Mark all as read
          </button>
        )}
      </div>
      <p className="muted small">
        Reminders come before an idea starts, as target and due dates near, and once when one passes; you also always hear about teams, tasks, comments and
        @mentions. Choose which reminders you get, and whether they’re emailed, in <Link to="/settings#reminders">Settings → Reminders</Link>.
      </p>
      {notifications.isLoading && <Skeleton variant="cards" />}
      <LoadError queries={notifications} />
      <ErrorMessage error={markAll.error} />
      {notifications.data?.items.length === 0 && (
        <div className="card empty">
          <p>Nothing yet. Reminders and updates about your ideas appear here.</p>
        </div>
      )}
      {notifications.data && notifications.data.items.length > 0 && (
        <>
          <div className="tabs" role="group" aria-label="Show">
            {filters.map((f) => (
              <button key={f.value} type="button" className={f === filter ? 'tab active' : 'tab'} aria-pressed={f === filter} onClick={() => choose(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          {shown.length === 0 && (
            <div className="card empty">
              <p>{filter.empty}</p>
            </div>
          )}
          <NotificationGroup title="Today" notifications={todays} />
          <NotificationGroup title="Earlier" notifications={earlier} />
        </>
      )}
    </div>
  );
}

/** Notifications that arrived in one stretch of time, under a heading; nothing when there are none. */
function NotificationGroup({ title, notifications }: { title: string; notifications: Notification[] }) {
  const headingId = useId();
  if (notifications.length === 0) {
    return null;
  }

  return (
    <section className="stack notification-group" aria-labelledby={headingId}>
      <h2 id={headingId} className="notification-group-title">
        {title}
      </h2>
      <ul className="notification-list">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </ul>
    </section>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead();
  const unread = notification.readAt === null;

  return (
    <li className={unread ? 'card notification unread' : 'card notification'}>
      <div className="row spread wrap">
        <span className="row wrap">
          <span className={`badge kind-${notification.kind.toLowerCase()}`}>{kindLabels[notification.kind]}</span>
          <WorkspaceTag workspaceId={notification.workspaceId} name={notification.workspaceName} />
        </span>
        <time className="muted small" dateTime={notification.createdAt}>
          {formatMoment(notification.createdAt)}
        </time>
      </div>
      <p className="notification-message">{notification.message}</p>
      <div className="row">
        <Link to={notificationLink(notification)} onClick={() => unread && markRead.mutate(notification.id)}>
          Open idea
        </Link>
        {unread && (
          <button type="button" className="button ghost small" onClick={() => markRead.mutate(notification.id)}>
            Mark as read
          </button>
        )}
      </div>
    </li>
  );
}
