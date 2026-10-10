import { Link } from 'react-router';

import { useNotifications } from '../api/queries';

/** Header link to the reminders page, showing how many are unread. */
export function NotificationBell() {
  const notifications = useNotifications();
  const unread = notifications.data?.unreadCount ?? 0;
  const label = unread === 0 ? 'Reminders' : `Reminders, ${unread} unread`;

  return (
    <Link to="/notifications" className="bell" aria-label={label} title={label}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}
