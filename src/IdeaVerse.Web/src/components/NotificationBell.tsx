import { Bell } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { formatAgo, formatMoment } from '../api/dates';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../api/queries';
import { notificationLink, type Notification, type ReminderKind } from '../api/types';
import { useWorkspace } from '../workspaces/WorkspaceContext';
import { WorkspaceTag } from '../workspaces/WorkspaceTag';

/** How many notifications the drop-down previews. */
const previewSize = 6;

/** The short line heading each notification in the drop-down; the full message shows on hover and on the notifications page. */
const titles: Record<ReminderKind, string> = {
  ComingUp: 'Coming up',
  Tomorrow: 'Due tomorrow',
  Today: 'Due today',
  Overdue: 'Overdue',
  Assigned: 'Assigned to you',
  AddedToTeam: 'Added to the team',
  Commented: 'New comment',
  Mentioned: 'You were mentioned',
  StartingSoon: 'Starting soon',
  AddComponents: 'Add components',
};

/**
 * The header bell: shows how many notifications are unread and previews the latest in a drop-down. `hidden` leaves only
 * the count on the installed app's icon, for phones, whose bottom bar links to the notifications instead.
 */
export function NotificationBell({ hidden = false }: { hidden?: boolean }) {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
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
    // Closing from inside the panel puts focus back on the bell, so keyboard users don't lose their place.
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      if (root.current?.contains(document.activeElement)) {
        button.current?.focus();
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useAppBadge(notifications.data?.unreadCount);

  const total = notifications.data?.items.length ?? 0;
  const items = notifications.data?.items.slice(0, previewSize) ?? [];
  if (hidden) {
    return null;
  }

  return (
    <div className="bell-menu" ref={root}>
      <button
        ref={button}
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
          <div className="notification-popover-head">
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
            <ul className="notification-menu">
              {items.map((n) => (
                <NotificationMenuItem key={n.id} notification={n} onOpen={() => !n.readAt && markRead.mutate(n.id)} />
              ))}
            </ul>
          )}
          <Link to="/notifications" className="notification-popover-foot small" aria-label={total > 0 ? `See all ${total} notifications` : undefined}>
            {total > 0 ? `See all ${total}` : 'See all notifications'}
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * One notification in the drop-down: what happened, to which idea (and which of its components, for an assignment or a
 * component's due date), how long ago, and a dot while it is unread. Its parts are laid out apart, so the link names them
 * in a sentence for screen readers.
 */
function NotificationMenuItem({ notification, onOpen }: { notification: Notification; onOpen: () => void }) {
  const { all } = useWorkspace();
  const unread = notification.readAt === null;
  const ago = formatAgo(notification.createdAt);
  const workspace = all.length > 1 ? `, ${all.find((w) => w.id === notification.workspaceId)?.name ?? notification.workspaceName}` : '';
  const component = notification.componentTitle;
  const subject = component ? `${component} for ${notification.ideaTitle}` : notification.ideaTitle;
  const label = `${titles[notification.kind]}${unread ? ', unread' : ''}: ${subject}, ${ago}${workspace}`;

  return (
    <li className={unread ? 'unread' : undefined}>
      <Link to={notificationLink(notification)} className="notification-menu-item" aria-label={label} title={notification.message} onClick={onOpen}>
        <span className="unread-dot" aria-hidden="true" />
        <span className="notification-menu-title">{titles[notification.kind]}</span>
        <span className="notification-menu-idea">{component ? `${component} · ${notification.ideaTitle}` : notification.ideaTitle}</span>
        <time className="notification-menu-time" dateTime={notification.createdAt} title={formatMoment(notification.createdAt)}>
          {ago}
        </time>
        <WorkspaceTag workspaceId={notification.workspaceId} name={notification.workspaceName} />
      </Link>
    </li>
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
