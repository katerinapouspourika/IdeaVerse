import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../api/queries';
import { notificationLink } from '../api/types';
import { WorkspaceTag } from '../workspaces/WorkspaceTag';

/** How many notifications the drop-down previews. */
const previewSize = 6;

/** The header bell: shows how many notifications are unread and previews the latest in a drop-down. */
export function NotificationBell() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const [openedOn, setOpenedOn] = useState(pathname);
  const unread = notifications.data?.unreadCount ?? 0;
  const label = unread === 0 ? 'Notifications' : `Notifications, ${unread} unread`;

  if (openedOn !== pathname) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: MouseEvent) => !root.current?.contains(event.target as Node) && setOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useAppBadge(notifications.data?.unreadCount);

  const items = notifications.data?.items.slice(0, previewSize) ?? [];

  return (
    <div className="bell-menu" ref={root}>
      <button
        type="button"
        className="bell icon-button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell aria-hidden="true" size={20} />
        {unread > 0 && <span className="bell-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div id={panelId} className="popover notification-popover" role="region" aria-label="Latest notifications">
          <div className="row spread">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="link-button small" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted small">Nothing yet. Reminders and updates about your ideas appear here.</p>
          ) : (
            <ul className="mini-list">
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? undefined : 'unread'}>
                  <Link to={notificationLink(n)} onClick={() => !n.readAt && markRead.mutate(n.id)}>
                    {n.message}
                  </Link>
                  <WorkspaceTag workspaceId={n.workspaceId} name={n.workspaceName} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="small">
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Shows the unread count on the installed app's icon, where the browser supports badges, and clears it once there is
 * nothing unread or the bell goes away, as on signing out.
 */
function useAppBadge(unread: number | undefined) {
  useEffect(() => {
    if (unread === undefined || !('setAppBadge' in navigator)) {
      return;
    }
    // Badging can be refused, for instance when the app is not installed; the bell still shows the count.
    const ignore = () => {};
    if (unread > 0) {
      navigator.setAppBadge(unread).catch(ignore);
    } else {
      navigator.clearAppBadge().catch(ignore);
    }
    return () => void navigator.clearAppBadge().catch(ignore);
  }, [unread]);
}
