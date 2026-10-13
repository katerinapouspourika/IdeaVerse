import { Link } from 'react-router';

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../api/queries';
import type { Notification, ReminderKind } from '../api/types';
import { ErrorMessage, LoadError } from '../components/ErrorMessage';
import { Skeleton } from '../components/Skeleton';
import { usePageMeta } from '../seo/usePageMeta';

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

export function NotificationsPage() {
  usePageMeta('Notifications', { index: false });
  const notifications = useNotifications();
  const markAll = useMarkAllNotificationsRead();
  const unread = notifications.data?.unreadCount ?? 0;

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
        Reminders arrive a week before, the day before, and on an idea’s target date or a task’s due date, and once if it becomes overdue. You also hear when you’re added to a team, given a task, or someone comments. Change what you get in Settings.
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
