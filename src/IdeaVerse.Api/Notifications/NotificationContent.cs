namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// Everything a notification's wording needs.
/// </summary>
/// <param name="Kind">What the notification is about.</param>
/// <param name="IdeaTitle">The idea's title.</param>
/// <param name="TargetDate">The date the countdown counts to: the idea's target date, or the component's due date.</param>
/// <param name="ComponentTitle">The component's title, for assignments and component countdowns.</param>
/// <param name="Actor">The name or email of who caused it, for teammates' actions; <see langword="null"/> for countdowns or a deleted account.</param>
/// <param name="Detail">Extra text, such as the start of a comment.</param>
public sealed record NotificationContent(
  ReminderKind Kind,
  string IdeaTitle,
  DateOnly TargetDate,
  string? ComponentTitle = null,
  string? Actor = null,
  string? Detail = null);
