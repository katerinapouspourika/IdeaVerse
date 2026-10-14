namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// A reminder as returned by the API.
/// </summary>
/// <param name="Id">The identifier.</param>
/// <param name="IdeaId">The idea the reminder is about.</param>
/// <param name="IdeaTitle">The idea's current title.</param>
/// <param name="WorkspaceId">The workspace the idea belongs to.</param>
/// <param name="WorkspaceName">That workspace's current name.</param>
/// <param name="Kind">The countdown stage.</param>
/// <param name="TargetDate">The idea's target date when the reminder was raised.</param>
/// <param name="Message">The reminder text.</param>
/// <param name="CreatedAt">When the reminder was raised.</param>
/// <param name="ReadAt">When the user marked it read, if they have.</param>
public sealed record NotificationResponse(
  Guid Id,
  Guid IdeaId,
  string IdeaTitle,
  Guid WorkspaceId,
  string WorkspaceName,
  ReminderKind Kind,
  DateOnly TargetDate,
  string Message,
  DateTimeOffset CreatedAt,
  DateTimeOffset? ReadAt);
