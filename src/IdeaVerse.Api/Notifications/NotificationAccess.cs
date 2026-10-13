namespace Pouspourika.IdeaVerse.Api.Notifications;

using Pouspourika.IdeaVerse.Api.Data;
using Pouspourika.IdeaVerse.Api.Ideas;

/// <summary>
/// Which notifications still concern their recipient.
/// </summary>
internal static class NotificationAccess
{
  /// <summary>
  /// Gets the notifications whose recipient is still in the idea's workspace and still concerned: mentioned, which concerns
  /// them as long as they are in the workspace; on the idea's team for other notifications about the idea; or still
  /// assigned for notifications about a component. Start reminders also stop concerning anyone once the start changes, or
  /// once the idea is in progress or done.
  /// </summary>
  /// <remarks>
  /// Only notifications raised since the recipient last joined the workspace, or the idea's team, count: someone removed
  /// and added back starts afresh rather than seeing what was raised during their earlier time there.
  /// </remarks>
  /// <param name="context">The database context.</param>
  /// <returns>A query over the notifications that still concern their recipient.</returns>
  public static IQueryable<Notification> StillRelevant(this IdeaVerseDbContext context)
    => context.Notifications.Where(n =>
      context.WorkspaceMembers.Any(w => w.WorkspaceId == n.Idea!.WorkspaceId && w.UserId == n.UserId && w.JoinedAt <= n.CreatedAt)
      && ((n.Kind != ReminderKind.StartingSoon && n.Kind != ReminderKind.AddComponents)
        || (n.StartsAt == n.Idea!.StartsAt && (n.Idea.Status == IdeaStatus.Planned || n.Idea.Status == IdeaStatus.Postponed)))
      && (n.Kind == ReminderKind.Mentioned
        || (n.ComponentId == null
          ? n.Idea!.OwnerId == n.UserId || n.Idea.Members.Any(m => m.UserId == n.UserId && m.AddedAt <= n.CreatedAt)
          : n.Component!.AssigneeId == n.UserId)));
}
