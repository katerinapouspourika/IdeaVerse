namespace Pouspourika.IdeaVerse.Api.Notifications;

using Pouspourika.IdeaVerse.Api.Data;

/// <summary>
/// Which notifications still concern their recipient.
/// </summary>
internal static class NotificationAccess
{
  /// <summary>
  /// Gets the notifications whose recipient is still in the idea's workspace and still concerned: on the idea's team for
  /// notifications about the idea, or still assigned for notifications about a component.
  /// </summary>
  /// <param name="context">The database context.</param>
  /// <returns>A query over the notifications that still concern their recipient.</returns>
  public static IQueryable<Notification> StillRelevant(this IdeaVerseDbContext context)
    => context.Notifications.Where(n =>
      context.WorkspaceMembers.Any(w => w.WorkspaceId == n.Idea!.WorkspaceId && w.UserId == n.UserId)
      && (n.ComponentId == null
        ? n.Idea!.OwnerId == n.UserId || n.Idea.Members.Any(m => m.UserId == n.UserId)
        : n.Component!.AssigneeId == n.UserId));
}
