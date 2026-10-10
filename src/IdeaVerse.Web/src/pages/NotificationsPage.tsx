import { Link } from 'react-router';

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../api/queries';
import type { Notification, ReminderKind } from '../api/types';
import { ErrorMessage } from '../components/ErrorMessage';

const kindLabels: Record<ReminderKind, string> = {
  ComingUp: 'Coming up',
  Tomorrow: 'Tomorrow',
  Today: 'Today',
  Overdue: 'Overdue',
};

export function NotificationsPage() {
  const notifications = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div className="stack">
      <div className="row spread wrap">
        <h1>Reminders</h1>
        {unread > 0 && (
          <button type="button" className="button" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            Mark all as read
          </button>
        )}
      </div>
      <p className="muted small">
        You get a reminder a week before, the day before, and on the day an idea is due, and once if it becomes overdue. Reminders are also emailed.
      </p>
      {notifications.isLoading && <p className="muted">Loading reminders…</p>}
      <ErrorMessage error={notifications.error ?? markAll.error} />
      {notifications.data?.items.length === 0 && (
        <div className="card empty">
          <p>No reminders yet. They appear here as your ideas’ dates get close.</p>
        </div>
      )}
      {notifications.data && notifications.data.items.length > 0 && (
        <ul className="notification-list">
          {notifications.data.items.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const markRead = useMarkNotificationRead();
  const unread = notification.readAt === null;

  return (
    <li className={unread ? 'card notification unread' : 'card notification'}>
      <div className="row spread wrap">
        <span className={`badge kind-${notification.kind.toLowerCase()}`}>{kindLabels[notification.kind]}</span>
        <time className="muted small" dateTime={notification.createdAt}>
          {new Date(notification.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </time>
      </div>
      <p className="notification-message">{notification.message}</p>
      <div className="row">
        <Link to={`/ideas/${notification.ideaId}`} onClick={() => unread && markRead.mutate(notification.id)}>
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
