namespace Pouspourika.IdeaVerse.Api.Notifications;

/// <summary>
/// When an idea starts, as a start reminder words it.
/// </summary>
/// <param name="Local">The start, in the reader's time zone.</param>
/// <param name="Notice">How long before the start the reminder was raised.</param>
/// <param name="Date">The start date as it was entered; shown instead of <paramref name="Local"/>'s date when no time was
/// given, so every reader sees the same day.</param>
/// <param name="HasTime">Whether the start was given a time of day.</param>
public sealed record StartContent(DateTime Local, TimeSpan Notice, DateOnly Date, bool HasTime)
{
  /// <summary>
  /// Builds a notification's start for a reader, or <see langword="null"/> when it is not about a start.
  /// </summary>
  /// <param name="startsAt">When the idea starts, as the notification recorded it.</param>
  /// <param name="raisedAt">When the notification was raised.</param>
  /// <param name="zone">The reader's time zone.</param>
  /// <param name="date">The idea's start date as entered.</param>
  /// <param name="hasTime">Whether the idea's start has a time of day.</param>
  /// <returns>The start, or <see langword="null"/>.</returns>
  public static StartContent? For(DateTimeOffset? startsAt, DateTimeOffset raisedAt, TimeZoneInfo zone, DateOnly? date, bool hasTime)
  {
    if (startsAt is not { } at)
    {
      return null;
    }

    var local = TimeZoneInfo.ConvertTime(at, zone).DateTime;
    return new StartContent(local, at - raisedAt, date ?? DateOnly.FromDateTime(local), hasTime);
  }
}
