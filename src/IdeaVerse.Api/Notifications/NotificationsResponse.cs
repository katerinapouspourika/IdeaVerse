namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// The user's recent reminders and how many are unread.
/// </summary>
/// <param name="Items">The most recent reminders, newest first.</param>
/// <param name="UnreadCount">How many of the user's reminders are unread, including any beyond <paramref name="Items"/>.</param>
public sealed record NotificationsResponse(IReadOnlyList<NotificationResponse> Items, int UnreadCount);
