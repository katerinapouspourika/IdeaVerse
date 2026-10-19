namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// A notification waiting to be emailed, with what its email needs to say.
/// </summary>
/// <param name="Notification">The notification, tracked so it can be marked emailed.</param>
/// <param name="Email">The recipient's address.</param>
/// <param name="TimeZone">The recipient's IANA time zone, or <see langword="null"/> for UTC.</param>
/// <param name="Frequency">How often the recipient wants emails.</param>
/// <param name="IdeaTitle">The idea's title.</param>
/// <param name="ComponentTitle">The component's title, for notifications about one.</param>
/// <param name="ActorName">Who did what the notification is about: their display name, else their email.</param>
/// <param name="StartDate">The idea's planned start date.</param>
/// <param name="StartHasTime">Whether the idea's start has a time of day.</param>
internal sealed record PendingEmail(
  Notification Notification,
  string? Email,
  string? TimeZone,
  EmailFrequency Frequency,
  string IdeaTitle,
  string? ComponentTitle,
  string? ActorName,
  DateOnly? StartDate,
  bool StartHasTime);
